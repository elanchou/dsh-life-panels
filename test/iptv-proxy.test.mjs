// Proxy client against local fake proxies: HTTP CONNECT, absolute-form http, SOCKS5 with and without auth.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { parseProxy, maskProxy, proxyRequest } from '../plugins/iptv/proxy.js';

const servers = [];
after(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));
const listen = (server) => new Promise((resolve) => { servers.push(server); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });

async function readAll(body) { const c = []; for await (const x of body) c.push(Buffer.from(x)); return Buffer.concat(c).toString('utf8'); }

const origin = http.createServer((req, res) => {
  if (req.url === '/redirect') { res.writeHead(302, { location: '/live.m3u8' }); return res.end(); }
  res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' });
  res.end('#EXTM3U\n#path=' + req.url + '\n');
});
const originPort = await listen(origin);

const seen = { connect: 0, absolute: 0, socks: 0, auth: [] };
const httpProxy = http.createServer((req, res) => {
  seen.absolute++;
  seen.auth.push(req.headers['proxy-authorization'] || '');
  const u = new URL(req.url);
  const up = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(up);
});
httpProxy.on('connect', (req, socket) => {
  seen.connect++;
  const [host, port] = req.url.split(':');
  const up = net.connect(Number(port), host, () => { socket.write('HTTP/1.1 200 Connection established\r\n\r\n'); up.pipe(socket); socket.pipe(up); });
  up.on('error', () => socket.destroy());
});
const httpProxyPort = await listen(httpProxy);

function socksServer(requireAuth) {
  return net.createServer((sock) => {
    let stage = 'hello'; let buf = Buffer.alloc(0);
    sock.on('data', function onData(d) {
      buf = Buffer.concat([buf, d]);
      if (stage === 'hello' && buf.length >= 2 + buf[1]) {
        const methods = [...buf.subarray(2, 2 + buf[1])]; buf = buf.subarray(2 + buf[1]);
        if (requireAuth) { if (!methods.includes(2)) return sock.end(Buffer.from([5, 255])); sock.write(Buffer.from([5, 2])); stage = 'auth'; }
        else { sock.write(Buffer.from([5, 0])); stage = 'req'; }
      }
      if (stage === 'auth' && buf.length >= 2 && buf.length >= 3 + buf[1] && buf.length >= 3 + buf[1] + buf[2 + buf[1]]) {
        const ul = buf[1]; const user = buf.subarray(2, 2 + ul).toString(); const pl = buf[2 + ul]; const pass = buf.subarray(3 + ul, 3 + ul + pl).toString();
        buf = buf.subarray(3 + ul + pl);
        const ok = user === 'u' && pass === 'p@ss';
        sock.write(Buffer.from([1, ok ? 0 : 1])); if (!ok) return sock.end(); stage = 'req';
      }
      if (stage === 'req' && buf.length >= 7) {
        let host; let off;
        if (buf[3] === 1) { host = [...buf.subarray(4, 8)].join('.'); off = 8; } else { host = buf.subarray(5, 5 + buf[4]).toString(); off = 5 + buf[4]; }
        if (buf.length < off + 2) return;
        const port = buf.readUInt16BE(off); const rest = buf.subarray(off + 2);
        sock.off('data', onData); seen.socks++;
        const up = net.connect(port, host === 'localhost' ? '127.0.0.1' : host, () => {
          sock.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
          if (rest.length) up.write(rest);
          up.pipe(sock); sock.pipe(up);
        });
        up.on('error', () => sock.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0])));
      }
    });
  });
}
const socksPort = await listen(socksServer(false));
const socksAuthPort = await listen(socksServer(true));

test('parseProxy accepts bare host:port, schemes and credentials', () => {
  assert.deepEqual(parseProxy('127.0.0.1:7890'), { kind: 'http', secure: false, host: '127.0.0.1', port: 7890, auth: '', label: 'http://127.0.0.1:7890' });
  assert.equal(parseProxy('socks5h://a:b%40c@h').port, 1080);
  assert.equal(parseProxy('socks5h://a:b%40c@h').auth, 'a:b@c');
  assert.throws(() => parseProxy('ftp://x'), /unsupported/);
  assert.equal(maskProxy('http://user:secret@h:1'), 'http://user:***@h:1');
  assert.equal(maskProxy('http://h:1'), 'http://h:1');
});

test('plain http goes through an HTTP proxy in absolute form, with Basic auth and redirects', async () => {
  const proxy = parseProxy('http://me:pw@127.0.0.1:' + httpProxyPort);
  const r = await proxyRequest('http://127.0.0.1:' + originPort + '/redirect', { proxy });
  assert.equal(r.status, 200);
  assert.match(await readAll(r.body), /#path=\/live\.m3u8/);
  assert.ok(seen.absolute >= 2);
  assert.equal(seen.auth.at(-1), 'Basic ' + Buffer.from('me:pw').toString('base64'));
});

test('HTTP CONNECT tunnel is used for non-absolute requests', async () => {
  // Force a tunnel by asking for an https URL whose TLS will fail, but CONNECT itself must succeed first.
  const proxy = parseProxy('http://127.0.0.1:' + httpProxyPort);
  const before = seen.connect;
  await assert.rejects(proxyRequest('https://127.0.0.1:' + originPort + '/x', { proxy }));
  assert.equal(seen.connect, before + 1);
});

test('SOCKS5 without and with username/password', async () => {
  const r = await proxyRequest('http://localhost:' + originPort + '/a?b=1', { proxy: parseProxy('socks5://127.0.0.1:' + socksPort) });
  assert.match(await readAll(r.body), /#path=\/a\?b=1/);
  const r2 = await proxyRequest('http://127.0.0.1:' + originPort + '/auth', { proxy: parseProxy('socks5://u:p%40ss@127.0.0.1:' + socksAuthPort) });
  assert.match(await readAll(r2.body), /#path=\/auth/);
  await assert.rejects(proxyRequest('http://127.0.0.1:' + originPort + '/', { proxy: parseProxy('socks5://u:bad@127.0.0.1:' + socksAuthPort) }), /login rejected/);
  await assert.rejects(proxyRequest('http://127.0.0.1:' + originPort + '/', { proxy: parseProxy('socks5://127.0.0.1:' + socksAuthPort) }), /requires a username/);
  assert.ok(seen.socks >= 2);
});

test('an unreachable proxy fails fast with an error', async () => {
  await assert.rejects(proxyRequest('http://127.0.0.1:' + originPort + '/', { proxy: parseProxy('socks5://127.0.0.1:1') }), /ECONNREFUSED/);
});
