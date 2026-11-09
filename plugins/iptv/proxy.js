import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

/**
 * Outbound proxy support for the IPTV Host (node's global fetch has no proxy option).
 * Supports http://, https:// (HTTP CONNECT / absolute-form) and socks5:// / socks5h:// (RFC 1928, optional user+password).
 */

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Parse "host:port", "http://user:pass@host:port", "socks5://host:1080". Throws a readable Error. */
export function parseProxy(input) {
  const s = String(input || '').trim();
  if (!s) throw new Error('proxy address is empty');
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'http://' + s); } catch { throw new Error('invalid proxy address'); }
  const scheme = u.protocol.slice(0, -1).toLowerCase();
  if (!['http', 'https', 'socks', 'socks5', 'socks5h'].includes(scheme)) {
    throw new Error('unsupported proxy scheme "' + scheme + '" (use http://, https:// or socks5://)');
  }
  if (!u.hostname) throw new Error('proxy host is missing');
  const socks = scheme.startsWith('socks');
  const port = Number(u.port) || (scheme === 'https' ? 443 : socks ? 1080 : 80);
  const auth = u.username ? decodeURIComponent(u.username) + ':' + decodeURIComponent(u.password) : '';
  const host = u.hostname.replace(/^\[|\]$/g, '');
  return { kind: socks ? 'socks' : 'http', secure: scheme === 'https', host, port, auth, label: (socks ? 'socks5://' : scheme + '://') + u.hostname + ':' + port };
}

/** Hide the password of a proxy address so it can be shown in the UI and returned to the agent. */
export function maskProxy(input) {
  return String(input || '').replace(/^([a-z][a-z0-9+.-]*:\/\/[^:@/]*):[^@/]*@/i, '$1:***@');
}

/** Buffered reader over a socket: take(check) resolves with the bytes `check(buffer)` says form the next unit. */
function reader(socket) {
  let buf = Buffer.alloc(0);
  let waiter = null;
  let failure = null;
  let ended = false;
  const wake = () => { if (waiter) { const w = waiter; waiter = null; w(); } };
  const onData = (d) => { buf = Buffer.concat([buf, d]); wake(); };
  const onError = (e) => { failure = e; wake(); };
  const onClose = () => { ended = true; wake(); };
  socket.on('data', onData); socket.on('error', onError); socket.on('close', onClose);
  return {
    async take(check) {
      for (;;) {
        const n = check(buf);
        if (n > 0) { const out = buf.subarray(0, n); buf = buf.subarray(n); return out; }
        if (failure) throw failure;
        if (ended) throw new Error('the proxy closed the connection');
        await new Promise((resolve) => { waiter = resolve; });
      }
    },
    /** Stop reading, hand unread bytes back to the socket and pause it for the next consumer. */
    release() {
      socket.off('data', onData); socket.off('error', onError); socket.off('close', onClose);
      socket.pause();
      if (buf.length) socket.unshift(buf);
    },
  };
}

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError', code: 'ABORT_ERR' });

/** Open a socket to host:port through the proxy, with the tunnel already established. */
async function tunnel(proxy, host, port, signal) {
  if (signal && signal.aborted) throw abortError();
  const socket = proxy.secure
    ? tls.connect({ host: proxy.host, port: proxy.port, servername: net.isIP(proxy.host) ? undefined : proxy.host })
    : net.connect(proxy.port, proxy.host);
  const onAbort = () => socket.destroy(abortError());
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    await new Promise((resolve, reject) => {
      socket.once(proxy.secure ? 'secureConnect' : 'connect', resolve);
      socket.once('error', reject);
    });
    const r = reader(socket);
    if (proxy.kind === 'http') {
      const target = net.isIPv6(host) ? '[' + host + ']:' + port : host + ':' + port;
      const auth = proxy.auth ? 'Proxy-Authorization: Basic ' + Buffer.from(proxy.auth).toString('base64') + '\r\n' : '';
      socket.write('CONNECT ' + target + ' HTTP/1.1\r\nHost: ' + target + '\r\n' + auth + '\r\n');
      const head = await r.take((b) => { const i = b.indexOf('\r\n\r\n'); return i < 0 ? 0 : i + 4; });
      const m = /^HTTP\/1\.[01] (\d{3})/.exec(head.toString('latin1'));
      if (!m || m[1] !== '200') throw new Error('proxy refused the tunnel (' + (m ? 'HTTP ' + m[1] : 'bad reply') + ')');
    } else {
      const [user, pass] = proxy.auth ? [proxy.auth.slice(0, proxy.auth.indexOf(':')), proxy.auth.slice(proxy.auth.indexOf(':') + 1)] : ['', ''];
      socket.write(proxy.auth ? Buffer.from([5, 2, 0, 2]) : Buffer.from([5, 1, 0]));
      const choice = await r.take((b) => (b.length >= 2 ? 2 : 0));
      if (choice[0] !== 5) throw new Error('not a SOCKS5 proxy');
      if (choice[1] === 2) {
        if (!proxy.auth) throw new Error('the SOCKS5 proxy requires a username and password');
        const u = Buffer.from(user); const p = Buffer.from(pass);
        socket.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([p.length]), p]));
        const ok = await r.take((b) => (b.length >= 2 ? 2 : 0));
        if (ok[1] !== 0) throw new Error('SOCKS5 login rejected');
      } else if (choice[1] !== 0) {
        throw new Error(proxy.auth ? 'the SOCKS5 proxy accepts no supported login method' : 'the SOCKS5 proxy requires a username and password');
      }
      const addr = net.isIPv4(host)
        ? Buffer.concat([Buffer.from([1]), Buffer.from(host.split('.').map(Number))])
        : Buffer.concat([Buffer.from([3, Buffer.byteLength(host)]), Buffer.from(host)]);
      socket.write(Buffer.concat([Buffer.from([5, 1, 0]), addr, Buffer.from([port >> 8, port & 255])]));
      const reply = await r.take((b) => {
        if (b.length < 5) return 0;
        const need = b[3] === 1 ? 10 : b[3] === 4 ? 22 : 7 + b[4];
        return b.length >= need ? need : 0;
      });
      if (reply[1] !== 0) {
        const why = ['', 'general failure', 'not allowed by the proxy ruleset', 'network unreachable', 'host unreachable', 'connection refused', 'TTL expired', 'command not supported', 'address type not supported'];
        throw new Error('SOCKS5 connect failed: ' + (why[reply[1]] || 'code ' + reply[1]));
      }
    }
    r.release();
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** One request through the proxy; resolves with the raw IncomingMessage (redirects are the caller's loop). */
async function once(url, { proxy, headers, signal, method }) {
  const secure = url.protocol === 'https:';
  const port = Number(url.port) || (secure ? 443 : 80);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const hdrs = { host: url.host, 'accept-encoding': 'identity', connection: 'close', ...headers };
  let req;
  if (proxy.kind === 'http' && !secure) {
    // Plain http through an HTTP proxy: send the absolute URI instead of opening a tunnel.
    if (proxy.auth) hdrs['proxy-authorization'] = 'Basic ' + Buffer.from(proxy.auth).toString('base64');
    req = (proxy.secure ? https : http).request({ host: proxy.host, port: proxy.port, method, path: url.href, headers: hdrs });
  } else {
    const raw = await tunnel(proxy, host, port, signal);
    // tunnel() leaves the socket paused so no byte is lost before the next reader attaches.
    const conn = secure ? tls.connect({ socket: raw, servername: net.isIP(host) ? undefined : host }) : raw;
    if (secure) raw.resume();
    const agent = new (secure ? https : http).Agent({ keepAlive: false });
    agent.createConnection = () => conn;
    req = (secure ? https : http).request({ method, path: url.pathname + url.search, headers: hdrs, agent });
    // The http client attaches its parser before emitting 'socket'; only then let the bytes flow.
    if (!secure) req.once('socket', (s) => s.resume());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => req.destroy(abortError());
    if (signal) { if (signal.aborted) { req.destroy(); return reject(abortError()); } signal.addEventListener('abort', onAbort, { once: true }); }
    req.once('response', (res) => { res.once('close', () => signal && signal.removeEventListener('abort', onAbort)); resolve(res); });
    req.once('error', reject);
    req.end();
  });
}

/** GET through the proxy, following up to 5 redirects. Resolves { status, headers, url, body } (body is a Readable). */
export async function proxyRequest(urlString, { proxy, headers = {}, signal, method = 'GET' } = {}) {
  let url = new URL(urlString);
  for (let hop = 0; ; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) URLs are supported');
    const res = await once(url, { proxy, headers, signal, method });
    const location = res.headers.location;
    if (REDIRECTS.has(res.statusCode) && location && hop < 5) {
      res.resume();
      url = new URL(location, url);
      continue;
    }
    return { status: res.statusCode, headers: res.headers, url: url.href, body: res };
  }
}
