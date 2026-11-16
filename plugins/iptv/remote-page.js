/** The phone remote page served on the LAN. Plain HTML/CSS/JS, no build step, no external requests. */
const P1 = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#0b0c10">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="遥控器">
<link rel="manifest" href="/manifest.webmanifest">
<title>电视遥控器</title>
<style>
:root{--bg:#0b0c10;--card:#15171f;--card2:#1c1f29;--line:rgba(255,255,255,.08);--ink:#f4f5f8;--ink2:rgba(236,238,245,.62);--ink3:rgba(236,238,245,.36);--brand:#4d6bfe;--red:#ff4d55;--gold:#ffc53d;--ok:#3ddc97}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:15px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",system-ui,sans-serif;overscroll-behavior:none}
body{display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 10px) 16px calc(env(safe-area-inset-bottom) + 10px);user-select:none;-webkit-user-select:none}
button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;touch-action:manipulation}
svg{display:block;flex:none}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:16px}
.brand i{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:var(--brand)}
.conn{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;background:var(--card);font-size:12px;color:var(--ink2)}
.conn b{width:7px;height:7px;border-radius:50%;background:var(--ink3)}
.conn.ok b{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.conn.warn b{background:var(--gold)}
.conn.bad b{background:var(--red)}
.now{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:14px;border-radius:22px;background:var(--card);border:1px solid var(--line);min-height:86px}
.now .glow{position:absolute;inset:-40%;background-size:cover;background-position:center;filter:blur(40px) saturate(160%);opacity:.32;pointer-events:none}
.logo{position:relative;flex:none;width:58px;height:58px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-weight:750;font-size:19px;color:#fff;overflow:hidden;background:linear-gradient(140deg,hsl(var(--h,220) 62% 52%),hsl(calc(var(--h,220) + 40) 58% 36%))}
.logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:10%;background:rgba(255,255,255,.95)}
.nowtxt{position:relative;min-width:0;flex:1}
.live{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--ink3)}
.live i{width:7px;height:7px;border-radius:50%;background:var(--ink3)}
.live.on{color:#ff6a70}.live.on i{background:var(--red);animation:pulse 1.6s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,77,85,.6)}100%{box-shadow:0 0 0 7px rgba(255,77,85,0)}}
.name{font-size:19px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.sub{font-size:12.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.favbtn{position:relative;flex:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07);color:var(--ink2)}
.favbtn.on{color:var(--gold)}.favbtn.on path{fill:currentColor}
.tabs{display:flex;gap:4px;margin:14px 0 12px;padding:4px;border-radius:14px;background:var(--card)}
.tabs button{flex:1;height:36px;border-radius:10px;font-size:14px;font-weight:600;color:var(--ink2)}
.tabs button.on{background:var(--card2);color:var(--ink);box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.view{flex:1;min-height:0;display:none;flex-direction:column}
.view.on{display:flex}
.pad{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;width:100%;max-width:420px;margin:0 auto}
.modes{display:inline-flex;padding:3px;border-radius:999px;background:var(--card);border:1px solid var(--line)}
.modes button{height:32px;padding:0 18px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink2)}
.modes button.on{background:var(--card2);color:var(--ink);box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.wheel{position:relative;flex:none;width:min(80vw,46vh,340px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 28%,#f6f6f8 0%,#dedee3 62%,#c6c6cd 100%);box-shadow:0 22px 60px -20px rgba(0,0,0,.85),inset 0 2px 2px rgba(255,255,255,.95),inset 0 -4px 8px rgba(0,0,0,.14);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.z{position:absolute;display:flex;align-items:center;justify-content:center;color:#62646f;font-weight:700;pointer-events:none;transition:color .12s,transform .12s}
.z.t{top:7.5%;left:50%;transform:translateX(-50%);font-size:15px;letter-spacing:.08em}
.z.b{bottom:8%;left:50%;transform:translateX(-50%)}
.z.l{left:9%;top:50%;transform:translateY(-50%)}
.z.r{right:9%;top:50%;transform:translateY(-50%)}
.z.hit{color:var(--brand)}
.z.t.hit{transform:translateX(-50%) scale(1.12)}
.hub{position:absolute;inset:31%;border-radius:50%;background:radial-gradient(circle at 50% 28%,#fcfcfd,#e6e6ea);box-shadow:inset 0 2px 3px rgba(255,255,255,.95),0 0 0 1px rgba(0,0,0,.12),0 3px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;color:#8d8f99;touch-action:none;cursor:pointer}
.hub:active,.hub.hit{background:radial-gradient(circle at 50% 28%,#e4e4e8,#d0d0d6);box-shadow:inset 0 3px 8px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.12)}
.hub .ico{opacity:0;transition:opacity .15s}.hub .ico.on{opacity:1}
.hint{margin:-4px 0 0;font-size:12px;color:var(--ink3);text-align:center;min-height:17px}
.vbar{display:flex;align-items:center;gap:12px;width:100%;max-width:300px;color:var(--ink2);transition:opacity .25s}
.vbar.dim{opacity:.55}
.vbar .trk{flex:1;height:6px;border-radius:999px;background:rgba(255,255,255,.16);overflow:hidden}
.vbar .trk i{display:block;height:100%;width:var(--v,100%);border-radius:inherit;background:#fff;transition:width .08s linear}
.vbar output{width:34px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums}
.bar{display:flex;gap:10px;width:100%}
.bar button{flex:1;height:48px;border-radius:16px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--ink2)}
.bar button:active{background:rgba(255,255,255,.1)}
.pv{color:var(--brand)}
</style>
`;

const P2 = String.raw`<style>
.numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:360px;width:100%;margin:0 auto}
.numshow{grid-column:1/4;height:64px;border-radius:18px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:700;letter-spacing:.08em;font-variant-numeric:tabular-nums;color:var(--ink)}
.numshow.empty{color:var(--ink3);font-size:15px;font-weight:500;letter-spacing:0}
.key{height:64px;border-radius:18px;background:var(--card);border:1px solid var(--line);font-size:24px;font-weight:600;display:flex;align-items:center;justify-content:center}
.key.go{background:var(--brand);border-color:transparent;color:#fff;font-size:16px}
.key.dim{color:var(--ink2);font-size:15px}
.search{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);color:var(--ink2)}
.search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;user-select:text;-webkit-user-select:text}
.search input::placeholder{color:var(--ink3)}
.seg{display:flex;gap:6px;margin:10px 0 6px;overflow-x:auto;scrollbar-width:none}
.seg::-webkit-scrollbar{display:none}
.chip{flex:none;height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--line);font-size:13px;color:var(--ink2);white-space:nowrap}
.chip.on{background:var(--ink);color:#0b0c10;border-color:var(--ink)}
.list{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;margin:0 -6px;padding:4px 6px 10px}
.ch{display:flex;align-items:center;gap:12px;width:100%;padding:8px;border-radius:16px;text-align:left}
.ch:active{background:rgba(255,255,255,.07)}
.ch.on{background:rgba(77,107,254,.2)}
.ch .n{flex:none;width:30px;text-align:right;font-size:12px;font-weight:600;color:var(--ink3);font-variant-numeric:tabular-nums}
.ch .logo{width:44px;height:44px;border-radius:13px;font-size:15px}
.ch .t{flex:1;min-width:0}
.ch .t b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch .t span{display:block;font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch .s{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--ink3)}
.ch .s.on{color:var(--gold)}.ch .s.on path{fill:currentColor}
.more{display:block;margin:10px auto;height:38px;padding:0 18px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:13px;color:var(--ink2)}
.empty{padding:40px 10px;text-align:center;color:var(--ink2);font-size:14px}
.toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 18px);transform:translate(-50%,20px);opacity:0;max-width:86%;padding:10px 16px;border-radius:14px;background:rgba(30,33,44,.96);border:1px solid var(--line);font-size:13.5px;transition:.25s;pointer-events:none;z-index:9}
.toast.show{opacity:1;transform:translate(-50%,0)}
.gate{position:fixed;inset:0;z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center;background:var(--bg)}
.gate.show{display:flex}
.gate h1{margin:6px 0 0;font-size:22px}
.gate p{margin:0;color:var(--ink2);font-size:14px;line-height:1.6}
@media (min-height:780px){.pad{gap:24px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="top">
  <div class="brand"><i>__TV__</i>遥控器</div>
  <div class="conn" id="conn"><b></b><span id="connText">连接中</span></div>
</div>
<div class="now" id="now">
  <div class="glow" id="glow"></div>
  <div class="logo" id="nowLogo"></div>
  <div class="nowtxt">
    <div class="live" id="live"><i></i><span id="liveText">LIVE</span></div>
    <div class="name" id="nowName">未在播放</div>
    <div class="sub" id="nowSub">在下方挑一个频道</div>
  </div>
  <button class="favbtn" id="fav" aria-label="收藏">__STAR__</button>
</div>
<div class="tabs" role="tablist">
  <button class="on" data-tab="pad">遥控</button>
  <button data-tab="num">数字</button>
  <button data-tab="list">频道</button>
</div>
<section class="view on" id="v-pad">
  <div class="pad">
    <div class="modes" role="tablist" aria-label="滚轮功能"><button class="on" data-mode="ch" role="tab">频道</button><button data-mode="vol" role="tab">音量</button></div>
    <div class="wheel" id="wheel" role="group" aria-label="点击滚轮：沿圆环滑动换台或调音量">
      <span class="z t" id="zt">MENU</span>
      <span class="z r" id="zr">__NEXT__</span>
      <span class="z b" id="zb">__PLAYPAUSE__</span>
      <span class="z l" id="zl">__PREV__</span>
      <button class="hub" id="hub" aria-label="静音"><span class="ico" id="hubIco">__MUTE__</span></button>
    </div>
    <p class="hint" id="hint">沿圆环转动换台 · 点圆环四边 · 中间键静音</p>
    <div class="vbar" id="vbar"><span>__VOLICON__</span><div class="trk"><i></i></div><output id="volOut">100</output></div>
    <div class="bar">
      <button data-cmd="show">__EXPAND__<span>打开电视</span></button>
      <button data-cmd="guide">__LIST__<span>列表</span></button>
      <button data-cmd="stop" class="stop">__POWER__<span>关闭</span></button>
    </div>
  </div>
</section>
<section class="view" id="v-num">
  <div class="numpad" id="numpad">
    <div class="numshow empty" id="numShow">输入频道号</div>
  </div>
</section>
<section class="view" id="v-list">
  <label class="search">__SEARCH__<input id="q" type="search" placeholder="搜索频道" autocomplete="off" enterkeyhint="search"></label>
  <div class="seg" id="seg"></div>
  <div class="list" id="list"></div>
</section>
<div class="toast" id="toast"></div>
<div class="gate" id="gate">__BIGTV__<h1 id="gateTitle">需要配对</h1><p id="gateText">请在电脑上打开「电视」面板，点右上角的遥控器图标，用手机扫描二维码。</p></div>
`;

const P3 = String.raw`<script>
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = new URLSearchParams(location.search).get('k') || localStorage.getItem('tvremote.key') || '';
  if (KEY) {
    localStorage.setItem('tvremote.key', KEY);
    if (location.search) history.replaceState(null, '', location.pathname); // keep the key out of screenshots and history
  }
  var mode = 'ch'; var preview = null; var wheelActive = false; var localVol = null; var lineup = [];
  var state = { channel: null, state: 'idle', paused: false, muted: false, volume: 1, index: -1, tvs: 0 };
  var connected = false;
  var tab = 'pad';
  var list = { items: [], total: 0, groups: [], fav: false, group: '', q: '', loading: false };

  function hue(s) { var x = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; }
  function initials(s) { s = String(s || '').replace(/[\s()[\]（）\-_.:·|]+/g, ''); var m = s.match(/^[A-Za-z0-9]{1,3}/); return (m ? m[0] : s.slice(0, 2)).toUpperCase(); }
  function logo(el, c) {
    el.style.setProperty('--h', hue(c ? c.name : ''));
    el.textContent = '';
    if (c && c.logo) {
      var img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = c.logo;
      img.onerror = function () { img.remove(); el.textContent = initials(c.name); };
      el.appendChild(img);
    } else el.textContent = c ? initials(c.name) : '';
  }
  function haptic() { if (navigator.vibrate) navigator.vibrate(12); }
  var toastTimer = 0;
  function toast(text) { var t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200); }

  function api(path, body) {
    return fetch(path, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: body ? { 'content-type': 'application/json', 'x-remote-key': KEY } : { 'x-remote-key': KEY },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { gate(true); throw new Error(j.error || 'unauthorized'); }
        if (!r.ok || j.ok === false) { var e = new Error(j.error || ('HTTP ' + r.status)); e.code = j.code; throw e; }
        return j;
      });
    });
  }
  function cmd(c, extra) {
    haptic();
    var body = { cmd: c }; for (var k in extra || {}) body[k] = extra[k];
    return api('/cmd', body).catch(function (e) { toast(e.code === 'no_tv' ? '电脑上的电视没有打开' : e.message); });
  }
  function gate(show, title, text) {
    $('gate').classList.toggle('show', !!show);
    if (title) $('gateTitle').textContent = title;
    if (text) $('gateText').textContent = text;
  }

  function render() {
    var c = state.channel;
    var conn = $('conn');
    conn.className = 'conn ' + (!connected ? 'bad' : state.tvs ? 'ok' : 'warn');
    $('connText').textContent = !connected ? '未连接' : state.tvs ? '已连接电视' : '电视未打开';
    if (preview && c && preview.c.id === c.id && !wheelActive) preview = null;
    var shown = preview ? preview.c : c;
    logo($('nowLogo'), shown);
    $('glow').style.backgroundImage = shown && shown.logo ? 'url("' + shown.logo.replace(/"/g, '%22') + '")' : 'none';
    $('nowName').textContent = shown ? shown.name : '未在播放';
    $('nowName').classList.toggle('pv', !!preview);
    var sub = c ? (state.index >= 0 ? 'CH ' + String(state.index + 1).padStart(2, '0') + ' · ' : '') + (c.group || '') : '在「频道」里挑一个';
    if (preview) sub = 'CH ' + String(preview.i + 1).padStart(2, '0') + ' · ' + (preview.c.group || '') + ' · 松手切换';
    if (c && state.state === 'error') sub = '播放失败：' + (state.error || '源不可用');
    if (c && state.state === 'loading') sub = '正在连接信号…';
    $('nowSub').textContent = sub;
    var live = $('live');
    live.className = 'live' + (c && state.state === 'playing' && !state.paused ? ' on' : '');
    $('liveText').textContent = state.pip ? '画中画' : (c && state.paused ? '已暂停' : 'LIVE');
    $('fav').classList.toggle('on', !!state.favorite);
    $('fav').style.visibility = c ? 'visible' : 'hidden';
    $('hubIco').classList.toggle('on', !!state.muted);
    $('hubIco').innerHTML = state.muted ? ICON.muted : ICON.mute;
    $('zb').innerHTML = c && !state.paused && state.state !== 'error' ? ICON.pausewheel : ICON.playpause;
    var v = Math.round((localVol !== null ? localVol : (state.muted ? 0 : state.volume)) * 100);
    $('vbar').style.setProperty('--v', v + '%');
    $('vbar').classList.toggle('dim', mode !== 'vol' && !wheelActive);
    $('volOut').textContent = v;
    var rows = document.querySelectorAll('.ch');
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('on', !!c && rows[i].dataset.id === c.id);
  }

  /* ---- live state over SSE ---- */
  var es = null;
  function connect() {
    if (!KEY) { gate(true); return; }
    if (es) es.close();
    es = new EventSource('/events?k=' + encodeURIComponent(KEY));
    es.addEventListener('state', function (e) {
      connected = true; gate(false);
      try { state = JSON.parse(e.data); } catch (err) { return; }
      render();
    });
    es.onopen = function () { connected = true; render(); };
    es.onerror = function () {
      connected = false; render();
      // EventSource hides the status code, so probe once to tell a bad key from a sleeping computer.
      fetch('/channels?limit=1', { headers: { 'x-remote-key': KEY }, cache: 'no-store' }).then(function (r) { if (r.status === 401) { es.close(); gate(true, '配对已失效', '二维码已更换或遥控已关闭。请在电脑的「电视」面板里重新扫码。'); } }).catch(function () {});
    };
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!es || es.readyState === 2)) connect(); });
`;

const P4 = String.raw`
  /* ---- tabs ---- */
  var tabs = document.querySelectorAll('.tabs button');
  for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function (e) {
    tab = e.currentTarget.dataset.tab;
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle('on', tabs[j] === e.currentTarget);
    var views = document.querySelectorAll('.view');
    for (var k = 0; k < views.length; k++) views[k].classList.toggle('on', views[k].id === 'v-' + tab);
    if (tab === 'list' && !list.items.length) loadList(false);
  });

  /* ---- pad: plain [data-cmd] buttons ---- */
  var cmdButtons = document.querySelectorAll('[data-cmd]');
  for (var b = 0; b < cmdButtons.length; b++) (function (btn) {
    btn.addEventListener('click', function () { cmd(btn.dataset.cmd); });
  })(cmdButtons[b]);

  /* ---- click wheel: turn the ring to change channel or volume, tap its four sides, press the hub to mute ---- */
  var modeBtns = document.querySelectorAll('[data-mode]');
  for (var m = 0; m < modeBtns.length; m++) modeBtns[m].addEventListener('click', function (e) {
    mode = e.currentTarget.dataset.mode; haptic();
    for (var j = 0; j < modeBtns.length; j++) modeBtns[j].classList.toggle('on', modeBtns[j] === e.currentTarget);
    $('hint').textContent = mode === 'ch' ? '沿圆环转动换台 · 点圆环四边 · 中间键静音' : '沿圆环转动调音量 · 顺时针变大';
    render();
  });
  function loadLineup() {
    return api('/channels?limit=500').then(function (r) { lineup = r.items || []; }).catch(function () {});
  }
  function curIndex() {
    var c = state.channel; if (!c || !lineup.length) return -1;
    for (var i = 0; i < lineup.length; i++) if (lineup[i].id === c.id) return i;
    return state.index;
  }
  var audio = null;
  function tickSound() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(2400, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + 0.012);
      g.gain.setValueAtTime(0.045, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.016);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  var commitTimer = 0; var previewTimer = 0; var volSend = 0; var volLast = 0;
  function commitPreview() {
    clearTimeout(commitTimer);
    if (!preview) return;
    var c = preview.c;
    cmd('tune', { id: c.id });
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () { preview = null; render(); }, 2500); // fall back if the TV never confirms
  }
  function stepChannel(dir) {
    if (!lineup.length) { loadLineup().then(function () { if (lineup.length) stepChannel(dir); }); return; }
    var base = preview ? preview.i : curIndex();
    var i = base < 0 ? (dir > 0 ? 0 : lineup.length - 1) : (base + dir + lineup.length) % lineup.length;
    preview = { c: lineup[i], i: i };
    clearTimeout(previewTimer); render();
    clearTimeout(commitTimer); commitTimer = setTimeout(commitPreview, 520);
  }
  function stepVolume(dir) {
    var v = localVol === null ? (state.muted ? 0 : state.volume) : localVol;
    localVol = Math.max(0, Math.min(1, Math.round((v + dir * 0.03) * 100) / 100));
    state.muted = localVol === 0; render();
    var now = Date.now();
    clearTimeout(volSend);
    if (now - volLast > 90) { volLast = now; api('/cmd', { cmd: 'volume', value: localVol }).catch(function () {}); }
    else volSend = setTimeout(function () { volLast = Date.now(); api('/cmd', { cmd: 'volume', value: localVol }).catch(function () {}); }, 90);
  }
  function tick(dir) { haptic(); tickSound(); if (mode === 'vol') stepVolume(dir); else stepChannel(dir); }

  var wheel = $('wheel'); var w = null;
  var zoneEls = { t: $('zt'), r: $('zr'), b: $('zb'), l: $('zl') };
  function zoneOf(deg) { return deg > -45 && deg <= 45 ? 'r' : deg > 45 && deg <= 135 ? 'b' : deg > -135 && deg <= -45 ? 't' : 'l'; }
  function flash(el) { el.classList.add('hit'); setTimeout(function () { el.classList.remove('hit'); }, 160); }
  function tapZone(z) {
    flash(zoneEls[z]); haptic();
    if (z === 't') document.querySelector('[data-tab=list]').click();
    else if (z === 'r') { if (mode === 'vol') cmd('volume_up'); else cmd('next'); }
    else if (z === 'l') { if (mode === 'vol') cmd('volume_down'); else cmd('prev'); }
    else cmd('toggle');
  }
  wheel.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.hub')) return;
    var r = wheel.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = e.clientX - cx, dy = e.clientY - cy;
    if (Math.hypot(dx, dy) < r.width * 0.19) return;
    e.preventDefault();
    var a = Math.atan2(dy, dx) * 180 / Math.PI;
    w = { cx: cx, cy: cy, last: a, acc: 0, total: 0, t0: Date.now(), zone: zoneOf(a), moved: false, id: e.pointerId };
    wheelActive = true; localVol = null;
    try { wheel.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    if (!loadedOnce) { loadedOnce = true; loadLineup(); }
  });
  var loadedOnce = false;
  wheel.addEventListener('pointermove', function (e) {
    if (!w || e.pointerId !== w.id) return;
    var a = Math.atan2(e.clientY - w.cy, e.clientX - w.cx) * 180 / Math.PI;
    var d = a - w.last; if (d > 180) d -= 360; if (d < -180) d += 360;
    w.last = a; w.acc += d; w.total += Math.abs(d);
    if (w.total > 9) w.moved = true;
    if (!w.moved) return;
    var th = mode === 'vol' ? 11 : 24;
    while (Math.abs(w.acc) >= th) { var dir = w.acc > 0 ? 1 : -1; w.acc -= dir * th; tick(dir); }
  });
  function endWheel(e) {
    if (!w || (e && e.pointerId !== w.id)) return;
    var s0 = w; w = null; wheelActive = false;
    if (!s0.moved && Date.now() - s0.t0 < 600 && e && e.type === 'pointerup') tapZone(s0.zone);
    else if (s0.moved && mode === 'ch') commitPreview();
    if (localVol !== null) { var keep = localVol; setTimeout(function () { if (!wheelActive && localVol === keep) { localVol = null; render(); } }, 900); }
    render();
  }
  wheel.addEventListener('pointerup', endWheel);
  wheel.addEventListener('pointercancel', endWheel);
  wheel.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  $('hub').addEventListener('click', function () { cmd('mute'); });

  $('fav').addEventListener('click', function () {
    if (!state.channel) return;
    haptic();
    var on = !state.favorite;
    state.favorite = on; render();
    api('/favorite', { id: state.channel.id, on: on }).then(function () { toast(on ? '已收藏' : '已取消收藏'); }).catch(function (e) { state.favorite = !on; render(); toast(e.message); });
  });

  /* ---- numpad: type a channel number, it tunes after a short pause or on OK ---- */
  var digits = ''; var numTimer = 0;
  var pad = $('numpad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'go'].forEach(function (k) {
    var el = document.createElement('button');
    el.className = 'key' + (k === 'go' ? ' go' : k === 'clear' ? ' dim' : '');
    el.textContent = k === 'go' ? '切换' : k === 'clear' ? '清除' : k;
    el.addEventListener('click', function () {
      haptic();
      if (k === 'clear') { digits = ''; showDigits(); return; }
      if (k === 'go') { submitDigits(); return; }
      if (digits.length >= 4) return;
      digits += k; showDigits();
      clearTimeout(numTimer); numTimer = setTimeout(submitDigits, 1600);
    });
    pad.appendChild(el);
  });
  function showDigits() {
    var s = $('numShow');
    s.classList.toggle('empty', !digits);
    s.textContent = digits || '输入频道号';
  }
  function submitDigits() {
    clearTimeout(numTimer);
    if (!digits) return;
    var n = Number(digits); digits = ''; showDigits();
    cmd('number', { n: n });
  }

  /* ---- channel list ---- */
  var searchTimer = 0;
  $('q').addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(function () { list.q = $('q').value.trim(); loadList(false); }, 260); });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('q').blur(); } });
  function loadList(more) {
    if (list.loading) return;
    list.loading = true;
    var qs = '?limit=150&offset=' + (more ? list.items.length : 0) + (list.q ? '&q=' + encodeURIComponent(list.q) : '') + (list.group ? '&group=' + encodeURIComponent(list.group) : '') + (list.fav ? '&fav=1' : '');
    if (!more) $('list').innerHTML = '<div class="empty">加载中…</div>';
    api('/channels' + qs).then(function (r) {
      list.items = more ? list.items.concat(r.items) : r.items;
      list.total = r.total; list.groups = r.groups || [];
      renderSeg(); renderList();
    }).catch(function (e) { $('list').innerHTML = ''; var d = document.createElement('div'); d.className = 'empty'; d.textContent = '加载失败：' + e.message; $('list').appendChild(d); })
      .then(function () { list.loading = false; });
  }
  function renderSeg() {
    var seg = $('seg'); seg.textContent = '';
    var chips = [{ k: 'all', label: '全部' }, { k: 'fav', label: '★ 收藏' }].concat(list.groups.slice(0, 30).map(function (g) { return { k: 'g', label: g.name, group: g.name }; }));
    chips.forEach(function (c) {
      var el = document.createElement('button');
      var on = c.k === 'fav' ? list.fav : c.k === 'all' ? (!list.fav && !list.group) : (!list.fav && list.group === c.group);
      el.className = 'chip' + (on ? ' on' : '');
      el.textContent = c.label;
      el.addEventListener('click', function () {
        haptic();
        if (c.k === 'fav') { list.fav = true; list.group = ''; }
        else if (c.k === 'all') { list.fav = false; list.group = ''; }
        else { list.fav = false; list.group = c.group; }
        loadList(false);
      });
      seg.appendChild(el);
    });
  }
  function renderList() {
    var box = $('list'); box.textContent = '';
    if (!list.items.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = list.fav ? '还没有收藏的频道' : '没有匹配的频道'; box.appendChild(e); return; }
    list.items.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'ch' + (state.channel && state.channel.id === c.id ? ' on' : '');
      row.dataset.id = c.id;
      row.setAttribute('role', 'button');
      var n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1).padStart(2, '0');
      var lg = document.createElement('span'); lg.className = 'logo'; logo(lg, c);
      var t = document.createElement('span'); t.className = 't';
      var b = document.createElement('b'); b.textContent = c.name;
      var s = document.createElement('span'); s.textContent = c.group || '';
      t.appendChild(b); t.appendChild(s);
      var star = document.createElement('button'); star.className = 's' + (c.favorite ? ' on' : ''); star.innerHTML = ICON.star; star.setAttribute('aria-label', '收藏');
      star.addEventListener('click', function (e) {
        e.stopPropagation(); haptic();
        var on = !c.favorite; c.favorite = on; star.classList.toggle('on', on);
        api('/favorite', { id: c.id, on: on }).catch(function (err) { c.favorite = !on; star.classList.toggle('on', !on); toast(err.message); });
      });
      row.appendChild(n); row.appendChild(lg); row.appendChild(t); row.appendChild(star);
      row.addEventListener('click', function () { cmd('tune', { id: c.id }).then(function () { toast('切换到 ' + c.name); }); });
      box.appendChild(row);
    });
    if (list.total > list.items.length) {
      var more = document.createElement('button'); more.className = 'more'; more.textContent = '加载更多（还有 ' + (list.total - list.items.length) + ' 个）';
      more.addEventListener('click', function () { loadList(true); });
      box.appendChild(more);
    }
  }

  render();
  connect();
})();
</script>
</body>
</html>
`;

const svg = (paths, size = 24, extra = '') => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + extra + '>' + paths.map((d) => '<path d="' + d + '"/>').join('') + '</svg>';
const ICONS = {
  TV: svg(['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 21h6', 'M8 3l4 2 4-2'], 16),
  BIGTV: svg(['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 21h6', 'M8 3l4 2 4-2'], 48, ' stroke-width="1.4"'),
  STAR: svg(['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z'], 20),
  PLUS: svg(['M12 6v12', 'M6 12h12'], 26),
  MINUS: svg(['M6 12h12'], 26),
  UP: svg(['M6 15l6-6 6 6'], 28),
  NEXT: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M5 6.2v11.6c0 .6.7 1 1.2.6l7.3-5.8c.4-.3.4-.9 0-1.2L6.2 5.6C5.7 5.2 5 5.6 5 6.2zM14.5 6.2v11.6c0 .6.7 1 1.2.6l5.2-4.1V9.7l-5.2-4.1c-.5-.4-1.2 0-1.2.6z"/></svg>',
  PREV: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M19 6.2v11.6c0 .6-.7 1-1.2.6l-7.3-5.8c-.4-.3-.4-.9 0-1.2l7.3-5.8c.5-.4 1.2 0 1.2.6zM9.5 6.2v11.6c0 .6-.7 1-1.2.6L3.1 14.3V9.7l5.2-4.1c.5-.4 1.2 0 1.2.6z"/></svg>',
  PLAYPAUSE: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M3.5 6v12c0 .6.7 1 1.2.6l7-6c.4-.3.4-.9 0-1.2l-7-6C4.2 5 3.5 5.4 3.5 6zM14 5.5h2.6v13H14zM18.4 5.5H21v13h-2.6z"/></svg>',
  DOWN: svg(['M6 9l6 6 6-6'], 28),
  MUTE: svg(['M4 10v4h4l5 4V6l-5 4z', 'M16.5 8.5a5 5 0 0 1 0 7'], 22),
  LIST: svg(['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'], 22),
  VOLICON: svg(['M4 10v4h4l5 4V6l-5 4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'], 20),
  EXPAND: svg(['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'], 18),
  POWER: svg(['M12 3v8', 'M6.6 6.6a8 8 0 1 0 10.8 0'], 18),
  SEARCH: svg(['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M20 20l-3.5-3.5'], 17),
};
const PLAY = '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path fill="currentColor" transform="translate(1.2 0)" d="M8.6 5.2c-.9-.55-2.1.1-2.1 1.15v11.3c0 1.05 1.2 1.7 2.1 1.15l9.3-5.65c.86-.52.86-1.78 0-2.3z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><g fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></g></svg>';
const MUTED = svg(['M4 10v4h4l5 4V6l-5 4z', 'M17 9.5l4.5 5', 'M21.5 9.5l-4.5 5'], 22);
const PAUSEGLYPH = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></g></svg>';
const SCRIPT_ICONS = 'var ICON = ' + JSON.stringify({ play: PLAY, pause: PAUSE, playpause: ICONS.PLAYPAUSE.replace('M3.5 6v12', 'M3.5 6v12'), pausewheel: PAUSEGLYPH, mute: ICONS.MUTE, muted: MUTED, star: ICONS.STAR.replace('width="20" height="20"', 'width="18" height="18"') }) + ';\n';

function fill(html) {
  return html.replace(/__([A-Z]+)__/g, (m, name) => (name === 'PLAY' ? PLAY : ICONS[name] || m));
}

export const REMOTE_HTML = fill(P1 + P2) + P3.replace("(function () {\n  'use strict';", "(function () {\n  'use strict';\n  " + SCRIPT_ICONS) + P4;
