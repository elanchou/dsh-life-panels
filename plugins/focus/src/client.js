window.__ModuleLoader__.load({
  id: '@local/focus',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'focus';
    const NS = 'focus';
    const call = makeCall('/plugin-api/focus');
    const SOUNDS = ['rain', 'ocean', 'fire', 'pink', 'brown', 'white'];

    /* ---- White noise: synthesized with Web Audio into seamless looping buffers, so no audio files ship. ---- */
    const noise = { ctx: null, master: null, src: null, extra: [], sound: 'rain', volume: 0.5, auto: true, playing: false, blocked: false, buffers: new Map() };
    try {
      const saved = JSON.parse(localStorage.getItem('dsh.focus.noise') || '{}');
      if (SOUNDS.includes(saved.sound)) noise.sound = saved.sound;
      if (typeof saved.volume === 'number') noise.volume = Math.min(1, Math.max(0, saved.volume));
      if (typeof saved.auto === 'boolean') noise.auto = saved.auto;
    } catch {}
    const persistNoise = () => { try { localStorage.setItem('dsh.focus.noise', JSON.stringify({ sound: noise.sound, volume: noise.volume, auto: noise.auto })); } catch {} };

    function audioCtx() {
      if (!noise.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        noise.ctx = new AC();
        noise.master = noise.ctx.createGain();
        noise.master.gain.value = 0;
        noise.master.connect(noise.ctx.destination);
      }
      return noise.ctx;
    }
    /** Fills `seconds` of audio per channel with gen(), cross-fading the tail into the head so the loop has no seam. */
    function makeBuffer(ac, seconds, gen) {
      const rate = ac.sampleRate; const len = Math.floor(rate * seconds); const fade = Math.floor(rate * 0.5);
      const buf = ac.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const raw = new Float32Array(len + fade);
        gen(raw, rate);
        const out = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) out[i] = raw[i];
        for (let i = 0; i < fade; i++) { const k = i / fade; out[i] = raw[i] * k + raw[len + i] * (1 - k); }
      }
      return buf;
    }
    function pinkFill(a, gain) {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < a.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * gain; b6 = w * 0.115926;
      }
    }
    function brownFill(a, gain) {
      let last = 0;
      for (let i = 0; i < a.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; a[i] = last * 3.5 * gain; }
    }
    /** Short decaying noise bursts: rain drops (bright) or fire crackles (sparse, sharper). */
    function addBursts(a, rate, perSec, minMs, maxMs, amp) {
      const n = Math.floor((a.length / rate) * perSec);
      for (let k = 0; k < n; k++) {
        const at = Math.floor(Math.random() * a.length);
        const dur = Math.floor(rate * (minMs + Math.random() * (maxMs - minMs)) / 1000);
        const g = amp * (0.25 + Math.random() * 0.75) * (Math.random() < 0.08 ? 2.2 : 1);
        let lp = 0;
        for (let i = 0; i < dur && at + i < a.length; i++) {
          lp += 0.5 * ((Math.random() * 2 - 1) - lp);
          a[at + i] += lp * g * Math.exp(-6 * i / dur);
        }
      }
    }
    const GENERATORS = {
      white: (a) => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * 0.28; },
      pink: (a) => pinkFill(a, 1),
      brown: (a) => brownFill(a, 1),
      rain: (a, rate) => { pinkFill(a, 0.55); addBursts(a, rate, 900, 3, 14, 0.18); },
      ocean: (a) => brownFill(a, 1.1),
      fire: (a, rate) => { brownFill(a, 0.75); addBursts(a, rate, 14, 2, 9, 0.9); addBursts(a, rate, 120, 1, 3, 0.25); },
    };
    function bufferFor(ac, sound) {
      if (!noise.buffers.has(sound)) noise.buffers.set(sound, makeBuffer(ac, sound === 'ocean' ? 16 : 10, GENERATORS[sound]));
      return noise.buffers.get(sound);
    }
    function teardownSource(at) {
      const old = [noise.src, ...noise.extra].filter(Boolean);
      noise.src = null; noise.extra = [];
      for (const n of old) { try { if (n.stop) n.stop(at); } catch {} setTimeout(() => { try { n.disconnect(); } catch {} }, 1200); }
    }
    function buildSource(ac, sound) {
      const src = ac.createBufferSource();
      src.buffer = bufferFor(ac, sound); src.loop = true;
      let tail = src;
      const extra = [];
      const filter = (type, freq, q) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; tail.connect(f); tail = f; extra.push(f); return f; };
      if (sound === 'rain') { filter('highpass', 350); filter('lowpass', 7500); }
      if (sound === 'fire') filter('lowpass', 3200);
      if (sound === 'ocean') {
        // Waves: a slow LFO swells both the level and the brightness.
        const lp = filter('lowpass', 500, 0.7);
        const swell = ac.createGain(); swell.gain.value = 0.55; tail.connect(swell); tail = swell; extra.push(swell);
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.085;
        const depth = ac.createGain(); depth.gain.value = 0.4; lfo.connect(depth); depth.connect(swell.gain);
        const fdepth = ac.createGain(); fdepth.gain.value = 380; lfo.connect(fdepth); fdepth.connect(lp.frequency);
        lfo.start(); extra.push(lfo, depth, fdepth);
      }
      tail.connect(noise.master);
      src.start();
      noise.src = src; noise.extra = extra;
    }
    const levelFor = () => Math.pow(noise.volume, 1.6) * 0.9;
    function noiseOn() {
      const ac = audioCtx();
      if (!ac) return;
      const begin = () => {
        noise.blocked = false;
        const now = ac.currentTime;
        if (!noise.src) buildSource(ac, noise.sound);
        noise.master.gain.cancelScheduledValues(now);
        noise.master.gain.setValueAtTime(noise.master.gain.value, now);
        noise.master.gain.linearRampToValueAtTime(levelFor(), now + 1.5);
        noise.playing = true; emit();
      };
      if (ac.state === 'running') begin();
      else ac.resume().then(() => { if (ac.state === 'running') begin(); else { noise.blocked = true; emit(); } }, () => { noise.blocked = true; emit(); });
      setTimeout(() => { if (ac.state !== 'running') { noise.blocked = true; emit(); } }, 600);
    }
    function noiseOff() {
      noise.playing = false; noise.blocked = false;
      if (noise.ctx && noise.src) {
        const now = noise.ctx.currentTime;
        noise.master.gain.cancelScheduledValues(now);
        noise.master.gain.setValueAtTime(noise.master.gain.value, now);
        noise.master.gain.linearRampToValueAtTime(0, now + 1.2);
        teardownSource(now + 1.3);
      }
      emit();
    }
    function setSound(sound) {
      noise.sound = sound; persistNoise();
      if (noise.playing && noise.ctx) {
        const now = noise.ctx.currentTime;
        noise.master.gain.cancelScheduledValues(now);
        noise.master.gain.setValueAtTime(noise.master.gain.value, now);
        noise.master.gain.linearRampToValueAtTime(0, now + 0.35);
        teardownSource(now + 0.4);
        setTimeout(() => { if (noise.playing) noiseOn(); }, 420);
      }
      emit();
    }
    function setVolume(v) {
      noise.volume = v; persistNoise();
      if (noise.playing && noise.ctx) noise.master.gain.setTargetAtTime(levelFor(), noise.ctx.currentTime, 0.08);
      emit();
    }
    function chime(kind) {
      const ac = audioCtx();
      if (!ac || ac.state !== 'running') return;
      const notes = kind === 'focus' ? [660, 880] : [880, 660, 523];
      notes.forEach((f, i) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        const t0 = ac.currentTime + i * 0.22;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 1.2);
      });
    }

    /* ---- Timer controller: also outside React, so the countdown, chime and noise survive panel switches. ---- */
    const ctl = { view: null, localEnd: 0, endTimer: null, listeners: new Set(), lastKey: '', error: null };
    function emit() { ctl.listeners.forEach((fn) => fn()); }
    const timerKey = (v) => (v && v.timer ? v.timer.id + ':' + v.timer.state : 'idle');
    function syncNoise() {
      if (!noise.auto) return;
      const tm = ctl.view && ctl.view.timer;
      if (tm && tm.phase === 'focus' && tm.state === 'running') noiseOn(); else if (noise.playing) noiseOff();
    }
    function accept(v) {
      const prevKey = ctl.lastKey; const prev = ctl.view;
      ctl.view = v; ctl.error = null;
      const tm = v.timer;
      ctl.localEnd = tm && tm.state === 'running' ? Date.now() + tm.remainingMs : 0;
      clearTimeout(ctl.endTimer);
      if (ctl.localEnd) ctl.endTimer = setTimeout(() => refresh(), Math.max(200, ctl.localEnd - Date.now() + 300));
      const key = timerKey(v);
      ctl.lastKey = key;
      if (prev && (v.events || []).length) chime(tm && tm.phase === 'focus' ? 'focus' : 'break');
      if (key !== prevKey) syncNoise();
      emit();
    }
    async function act(body) {
      try { accept(await call(body)); }
      catch (e) { ctl.error = e.message; emit(); }
    }
    const refresh = () => act({ action: 'status' });
    function useCtl() {
      const [, setTick] = useState(0);
      useEffect(() => { const fn = () => setTick((n) => n + 1); ctl.listeners.add(fn); return () => { ctl.listeners.delete(fn); }; }, []);
      return ctl;
    }
    function remainingMs() {
      const tm = ctl.view && ctl.view.timer;
      if (!tm) return 0;
      return tm.state === 'running' ? Math.max(0, ctl.localEnd - Date.now()) : tm.remainingMs;
    }
    function fmtClock(ms) {
      const s = Math.ceil(ms / 1000);
      return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    }

    const zh = {
      dateLocale: 'zh-CN', panel: '专注', title: '专注',
      ph_focus: '专注', ph_short: '短休息', ph_long: '长休息', ready: '准备好了',
      start: '开始', resume: '继续', pause: '暂停', stop: '结束', skip: '跳过', startNext: '开始{p}',
      taskPlaceholder: '这一轮要做什么？', cycle: '第 {n} / {m} 个番茄',
      statToday: '今日番茄', statMinutes: '今日专注', statWeek: '本周专注', statStreak: '连续天数',
      min: '{n} 分钟', hm: '{h} 小时 {m} 分',
      noise: '白噪音', noiseAuto: '专注时自动播放，休息时停止', play: '播放', stopNoise: '停止', volume: '音量',
      s_rain: '雨声', s_ocean: '海浪', s_fire: '篝火', s_pink: '粉噪音', s_brown: '棕噪音', s_white: '白噪音',
      blocked: '浏览器拦截了自动播放，点一下播放即可', week: '最近 7 天', tasks: '本周在忙', recent: '最近记录',
      noRecent: '完成第一个番茄后，这里会出现记录', partial: '未完成',
      settings: '时长设置', focusMin: '专注', shortMin: '短休息', longMin: '长休息', longEvery: '几轮后长休息', dailyGoal: '每日目标',
      autoBreak: '专注结束自动开始休息', autoFocus: '休息结束自动开始专注', minutesUnit: '分钟', roundsUnit: '轮', pomoUnit: '个',
      loadFailed: '操作失败：{error}', retry: '重试', delete: '删除',
      hint: '可以在对话里说“开一个 50 分钟的番茄，写周报”或“这周我专注了多久”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Focus', title: 'Focus',
      ph_focus: 'Focus', ph_short: 'Short break', ph_long: 'Long break', ready: 'Ready',
      start: 'Start', resume: 'Resume', pause: 'Pause', stop: 'End', skip: 'Skip', startNext: 'Start {p}',
      taskPlaceholder: 'What are you working on?', cycle: 'Pomodoro {n} of {m}',
      statToday: 'Pomodoros today', statMinutes: 'Focused today', statWeek: 'This week', statStreak: 'Day streak',
      min: '{n} min', hm: '{h}h {m}m',
      noise: 'White noise', noiseAuto: 'Plays during focus, stops on breaks', play: 'Play', stopNoise: 'Stop', volume: 'Volume',
      s_rain: 'Rain', s_ocean: 'Ocean', s_fire: 'Campfire', s_pink: 'Pink noise', s_brown: 'Brown noise', s_white: 'White noise',
      blocked: 'The browser blocked autoplay; press Play once', week: 'Last 7 days', tasks: 'This week', recent: 'Recent',
      noRecent: 'Finished pomodoros will show up here', partial: 'partial',
      settings: 'Durations', focusMin: 'Focus', shortMin: 'Short break', longMin: 'Long break', longEvery: 'Long break every', dailyGoal: 'Daily goal',
      autoBreak: 'Start breaks automatically', autoFocus: 'Start focus automatically after breaks', minutesUnit: 'min', roundsUnit: 'rounds', pomoUnit: '',
      loadFailed: 'Action failed: {error}', retry: 'Retry', delete: 'Delete',
      hint: 'Ask in chat: “Start a 50-minute pomodoro for the weekly report” or “How long did I focus this week?”',
    };

    Object.assign(ICONS, {
      timer: ['M12 8v5l3 2', 'M5 13a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M10 3h4', 'M12 3v3'],
      play: ['M8 5.5v13l11-6.5z'],
      pause: ['M8 5v14', 'M16 5v14'],
      stop: ['M6.5 6.5h11v11h-11z'],
      skip: ['M6 5.5v13l9-6.5z', 'M18 5v14'],
      rain: ['M7 15a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 7.5a3.75 3.75 0 0 1 .5 7.5', 'M8 18l-1 2.5', 'M12 18l-1 2.5', 'M16 18l-1 2.5'],
      ocean: ['M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9', 'M3 14c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14', 'M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19'],
      fire: ['M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5C13 9 11.5 10 10.5 8 9 10 6 12 6 15a6 6 0 0 0 6 6z', 'M12 21a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1.5-2.5-2.5-4-1 1.5-2.5 2.5-2.5 4A2.5 2.5 0 0 0 12 21z'],
      wave: ['M3 12h2', 'M7 8v8', 'M11 5v14', 'M15 9v6', 'M19 11v2'],
      flame: ['M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5C13 9 11.5 10 10.5 8 9 10 6 12 6 15a6 6 0 0 0 6 6z'],
      volume: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
    });
    const SOUND_ICON = { rain: 'rain', ocean: 'ocean', fire: 'fire', pink: 'wave', brown: 'wave', white: 'wave' };
    const PHASE_TONE = { focus: ERR, short: OK, long: BRAND };

    function FocusIcon(props) {
      const c = useCtl();
      const tm = c.view && c.view.timer;
      return h('span', { className: 'fc-glyph' }, h(Icon, { name: 'timer', size: props.size || 18, stroke: props.active ? 2 : 1.6 }),
        tm && tm.state === 'running' ? h('i', { className: 'fc-glyph-dot is-' + tm.phase }) : null);
    }
    const fmtMin = (m, t) => (m >= 60 ? t('hm', { h: Math.floor(m / 60), m: m % 60 }) : t('min', { n: m }));

    function TimerCard(props) {
      const { t, v } = props;
      const tm = v.timer;
      const [, setTick] = useState(0);
      const running = tm && tm.state === 'running';
      useEffect(() => { if (!running) return undefined; const id = setInterval(() => setTick((n) => n + 1), 250); return () => clearInterval(id); }, [running]);
      const [task, setTask] = useState('');
      const taskSource = tm && tm.phase === 'focus' ? tm.task : (v.recentTasks[0] || '');
      useEffect(() => { setTask(taskSource || ''); }, [tm && tm.id, taskSource]);
      const phase = tm ? tm.phase : v.next;
      const total = tm ? tm.durationMs : (phase === 'focus' ? v.settings.focusMin : phase === 'short' ? v.settings.shortMin : v.settings.longMin) * 60000;
      const left = tm ? remainingMs() : total;
      const frac = total ? 1 - left / total : 0;
      const R = 108; const C = 2 * Math.PI * R;
      useEffect(() => {
        const label = tm ? fmtClock(left) + ' · ' + t('ph_' + tm.phase) : null;
        if (label && running) { const old = document.title; document.title = label; return () => { document.title = old; }; }
        return undefined;
      });
      const commitTask = () => { if ((tm && tm.phase === 'focus' ? tm.task : v.recentTasks[0] || '') !== task.trim()) act({ action: 'task', task: task.trim() }); };
      const startFocus = () => act({ action: 'start', phase: 'focus', task: task.trim() });
      const cycleN = phase === 'focus' ? (v.cycle % v.settings.longEvery) + 1 : (v.cycle % v.settings.longEvery) || v.settings.longEvery;
      return h('section', { className: 'lp-card fc-timer is-' + phase, style: { '--fc-tone': 'var(' + PHASE_TONE[phase] + ')' } },
        h(Tabs, { value: phase, onChange: (p) => act({ action: 'start', phase: p, task: p === 'focus' ? task.trim() : undefined }), items: ['focus', 'short', 'long'].map((p) => ({ id: p, label: t('ph_' + p) })) }),
        h('div', { className: 'fc-ring-wrap' },
          h('svg', { className: 'fc-ring', viewBox: '0 0 240 240', 'aria-hidden': true },
            h('circle', { className: 'fc-ring-track', cx: 120, cy: 120, r: R }),
            h('circle', { className: 'fc-ring-fill', cx: 120, cy: 120, r: R, strokeDasharray: C, strokeDashoffset: C * (1 - frac), transform: 'rotate(-90 120 120)' })),
          h('div', { className: 'fc-ring-center' },
            h('span', { className: 'fc-phase' }, tm ? t('ph_' + tm.phase) + (tm.state === 'paused' ? ' · ' + t('pause') : '') : t('ready')),
            h('span', { className: 'fc-clock', role: 'timer', 'aria-live': 'off' }, fmtClock(left)),
            h('span', { className: 'fc-cycle' }, t('cycle', { n: cycleN, m: v.settings.longEvery })))),
        phase === 'focus' ? h('input', {
          className: 'lp-input fc-task', value: task, maxLength: 80, placeholder: t('taskPlaceholder'), 'aria-label': t('taskPlaceholder'),
          onChange: (e) => setTask(e.target.value), onBlur: commitTask,
          onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!tm) startFocus(); else e.currentTarget.blur(); } },
          list: 'fc-task-list',
        }) : h('div', { className: 'fc-task-gap' }),
        h('datalist', { id: 'fc-task-list' }, v.recentTasks.map((x) => h('option', { key: x, value: x }))),
        h('div', { className: 'fc-controls' },
          tm ? h('button', { type: 'button', className: 'lp-round fc-side', onClick: () => act({ action: 'stop' }), title: t('stop'), 'aria-label': t('stop') }, h(Icon, { name: 'stop', size: 18 })) : h('span', { className: 'fc-side' }),
          h('button', {
            type: 'button', className: 'fc-main', onClick: () => (running ? act({ action: 'pause' }) : tm ? act({ action: 'start' }) : phase === 'focus' ? startFocus() : act({ action: 'start', phase })),
            'aria-label': running ? t('pause') : tm ? t('resume') : t('start'),
          }, h(Icon, { name: running ? 'pause' : 'play', size: 22, stroke: 2.2 }), running ? t('pause') : tm ? t('resume') : t('start')),
          h('button', { type: 'button', className: 'lp-round fc-side', onClick: () => act({ action: 'skip' }), disabled: !tm, title: t('skip'), 'aria-label': t('skip') }, h(Icon, { name: 'skip', size: 18 }))));
    }

    function NoiseCard(props) {
      const { t, v } = props;
      const tm = v.timer;
      const focusing = tm && tm.phase === 'focus' && tm.state === 'running';
      return h('section', { className: 'lp-card fc-noise' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'volume', className: 'lp-ico' }), t('noise')),
          h('button', { type: 'button', className: 'lp-ghost' + (noise.playing ? ' is-on' : ''), onClick: () => (noise.playing ? noiseOff() : noiseOn()) },
            h(Icon, { name: noise.playing ? 'pause' : 'play', size: 14 }), noise.playing ? t('stopNoise') : t('play'))),
        h('div', { className: 'fc-sounds' }, SOUNDS.map((s) => h('button', {
          key: s, type: 'button', className: 'fc-sound' + (noise.sound === s ? ' is-active' : '') + (noise.sound === s && noise.playing ? ' is-playing' : ''),
          onClick: () => { setSound(s); if (!noise.playing) noiseOn(); }, 'aria-pressed': noise.sound === s,
        }, h(Icon, { name: SOUND_ICON[s], size: 20 }), h('span', null, t('s_' + s))))),
        h('label', { className: 'fc-volume' }, h(Icon, { name: 'volume', size: 14 }),
          h('input', { type: 'range', min: 0, max: 100, value: Math.round(noise.volume * 100), 'aria-label': t('volume'),
            style: { '--fc-pct': Math.round(noise.volume * 100) + '%' }, onChange: (e) => setVolume(Number(e.target.value) / 100) })),
        h('label', { className: 'fc-check' },
          h('input', { type: 'checkbox', checked: noise.auto, onChange: (e) => { noise.auto = e.target.checked; persistNoise(); if (noise.auto) syncNoise(); emit(); } }),
          h('span', null, t('noiseAuto'))),
        noise.blocked && (focusing || noise.playing) ? h('p', { className: 'fc-blocked' }, h(Icon, { name: 'alert', size: 14 }), t('blocked')) : null);
    }

    function StatsCard(props) {
      const { t, v } = props;
      const lang = safeLocale(t);
      const max = Math.max(v.settings.focusMin, ...v.stats.week.map((d) => d.minutes));
      return h('section', { className: 'lp-card fc-stats' },
        h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'calendar', className: 'lp-ico' }), t('week')),
        h('div', { className: 'fc-chart' }, v.stats.week.map((d) => h('div', { key: d.date, className: 'fc-col' + (d.date === v.stats.today.date ? ' is-today' : ''), title: fmtMin(d.minutes, t) },
          h('span', { className: 'fc-col-n' }, d.minutes ? d.minutes : ''),
          h('div', { className: 'fc-col-bar' }, h('i', { style: { height: (d.minutes / max) * 100 + '%' } })),
          h('span', { className: 'fc-col-d' }, fmtDate(d.date, lang, { weekday: 'narrow' }))))),
        v.stats.topTasks.length ? h(React.Fragment, null,
          h('h4', { className: 'fc-sub' }, t('tasks')),
          h('ul', { className: 'fc-tasks' }, v.stats.topTasks.map((x) => h('li', { key: x.task },
            h('span', { className: 'fc-task-name' }, x.task), h('span', { className: 'lp-muted' }, fmtMin(x.minutes, t)))))) : null,
        h('h4', { className: 'fc-sub' }, t('recent')),
        v.recent.length ? h('ul', { className: 'fc-recent' }, v.recent.map((s) => h('li', { key: s.id },
          h('i', { className: 'fc-dot' + (s.completed ? '' : ' is-partial') }),
          h('span', { className: 'fc-recent-time' }, new Date(s.startedAt).toLocaleString(lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
          h('span', { className: 'fc-task-name' }, s.task || t('ph_focus')),
          h('span', { className: 'lp-muted' }, fmtMin(s.minutes, t) + (s.completed ? '' : ' · ' + t('partial'))),
          h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger fc-del', onClick: () => act({ action: 'delete_session', id: s.id }), 'aria-label': t('delete'), title: t('delete') }, h(Icon, { name: 'trash', size: 13 })))))
          : h('p', { className: 'lp-muted fc-none' }, t('noRecent')));
    }

    function SettingsCard(props) {
      const { t, v } = props;
      const num = (key, unit, min, max) => h('label', { className: 'fc-num' }, h('span', null, t(key)),
        h('span', { className: 'lp-field' },
          h('input', { type: 'number', min, max, defaultValue: v.settings[key], key: key + v.settings[key], 'aria-label': t(key),
            onBlur: (e) => { const n = Number(e.target.value); if (n !== v.settings[key] && n >= min && n <= max) act({ action: 'settings', [key]: n }); },
            onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur(); } }),
          unit ? h('span', null, t(unit)) : null));
      const check = (key) => h('label', { className: 'fc-check' },
        h('input', { type: 'checkbox', checked: !!v.settings[key], onChange: (e) => act({ action: 'settings', [key]: e.target.checked }) }), h('span', null, t(key)));
      return h('section', { className: 'lp-card fc-settings' },
        h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'settings', className: 'lp-ico' }), t('settings')),
        h('div', { className: 'fc-nums' }, num('focusMin', 'minutesUnit', 1, 180), num('shortMin', 'minutesUnit', 1, 60), num('longMin', 'minutesUnit', 1, 90),
          num('longEvery', 'roundsUnit', 2, 12), num('dailyGoal', 'pomoUnit', 1, 24)),
        check('autoBreak'), check('autoFocus'));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const c = useCtl();
      useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, []);
      const v = c.view;
      const s = v ? v.stats : null;
      return h('div', { className: 'lp-root fc-root' + (v && v.timer ? ' is-' + v.timer.phase : '') },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, new Date().toLocaleDateString(safeLocale(t), { month: 'long', day: 'numeric', weekday: 'long' })), h('h1', { className: 'lp-title' }, t('title'))),
            s ? h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'timer', value: s.today.count + ' / ' + s.today.goal, label: t('statToday'), tone: s.today.count >= s.today.goal ? 'tone-success' : 'tone-error' }),
              h(Stat, { icon: 'clock', value: fmtMin(s.today.minutes, t), label: t('statMinutes'), tone: 'tone-brand' }),
              h(Stat, { icon: 'calendar', value: fmtMin(s.weekMinutes, t), label: t('statWeek') }),
              h(Stat, { icon: 'flame', value: s.streak, label: t('statStreak'), tone: s.streak ? 'tone-warn' : undefined })) : null),
          h(ErrorBar, { error: c.error ? t('loadFailed', { error: c.error }) : null, onRetry: refresh, retryLabel: t('retry'), onClose: () => { ctl.error = null; emit(); } }),
          !v ? h('div', { className: 'lp-card' }, h('div', { className: 'lp-skel', style: { height: 360 } }))
            : h('div', { className: 'fc-grid' },
              h('div', { className: 'fc-col-main' }, h(TimerCard, { t, v }), h(NoiseCard, { t, v })),
              h('div', { className: 'fc-col-side' }, h(StatsCard, { t, v }), h(SettingsCard, { t, v }))),
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      '.fc-root{--lp-amb-a:var(' + ERR + ');--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + BRAND + ')}',
      '.fc-root.is-short{--lp-amb-a:var(' + OK + ');--lp-amb-b:var(' + BRAND + ');--lp-amb-c:var(' + OK + ')}',
      '.fc-root.is-long{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + OK + ');--lp-amb-c:var(' + BRAND + ')}',
      '.fc-glyph{position:relative;display:inline-flex}',
      '.fc-glyph-dot{position:absolute;top:-1px;right:-2px;width:7px;height:7px;border-radius:50%;background:var(' + ERR + ');box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base))}',
      '.fc-glyph-dot.is-short,.fc-glyph-dot.is-long{background:var(' + OK + ')}',
      '.fc-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}',
      '.fc-col-main,.fc-col-side{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.fc-timer{display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 18px 22px}',
      '.fc-ring-wrap{position:relative;width:min(280px,72vw);aspect-ratio:1}',
      '.fc-ring{width:100%;height:100%}',
      '.fc-ring circle{fill:none;stroke-width:9}',
      '.fc-ring-track{stroke:' + tint('--dsw-alias-label-primary', 8) + '}',
      '.fc-ring-fill{stroke:var(--fc-tone);stroke-linecap:round;transition:stroke-dashoffset .3s linear,stroke .3s;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--fc-tone) 45%,transparent))}',
      '.fc-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}',
      '.fc-phase{font-size:13px;font-weight:600;color:var(--fc-tone)}',
      '.fc-clock{font-size:60px;line-height:68px;font-weight:300;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.fc-cycle{font-size:12px;color:' + FG2 + '}',
      '.fc-task{max-width:360px;text-align:center}',
      '.fc-task-gap{height:34px}',
      '.fc-controls{display:flex;align-items:center;justify-content:center;gap:18px}',
      '.fc-side{width:44px;height:44px}',
      '.fc-side:disabled{opacity:.35;cursor:default}',
      '.fc-main{display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 30px;border:0;border-radius:999px;background:var(--fc-tone);color:#fff;font-size:16px;font-weight:650;cursor:pointer;box-shadow:0 8px 22px -10px var(--fc-tone);transition:filter .15s,transform .15s}',
      '.fc-main:hover{filter:brightness(1.07);transform:translateY(-1px)}',
      '.fc-noise .lp-ghost.is-on{color:var(' + BRAND + ')}',
      '.fc-sounds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}',
      '.fc-sound{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:' + FG2 + ';font-size:12.5px;cursor:pointer;transition:color .15s,border-color .15s,background .15s}',
      '.fc-sound:hover{color:' + FG + '}',
      '.fc-sound.is-active{color:var(' + BRAND + ');border-color:' + tint(BRAND, 45) + ';background:' + tint(BRAND, 10) + '}',
      '.fc-sound.is-playing svg{animation:fc-breathe 2.4s ease-in-out infinite}',
      '@keyframes fc-breathe{50%{transform:scale(1.12);opacity:.75}}',
      '.fc-volume{display:flex;align-items:center;gap:10px;color:' + FG2 + ';margin-bottom:10px}',
      '.fc-volume input{flex:1;height:4px;-webkit-appearance:none;appearance:none;border-radius:999px;background:linear-gradient(to right,var(' + BRAND + ') var(--fc-pct),' + B2 + ' var(--fc-pct));cursor:pointer}',
      '.fc-volume input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(' + BRAND + ');box-shadow:0 0 0 3px ' + tint(BRAND, 20) + '}',
      '.fc-volume input::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:var(' + BRAND + ')}',
      '.fc-check{display:flex;align-items:center;gap:8px;font-size:12.5px;color:' + FG2 + ';cursor:pointer;margin-top:8px}',
      '.fc-check input{accent-color:var(' + BRAND + ');width:15px;height:15px;margin:0}',
      '.fc-blocked{display:flex;align-items:center;gap:6px;margin:10px 0 0;font-size:12px;color:var(' + WARN + ')}',
      '.fc-chart{display:flex;align-items:flex-end;gap:8px;height:130px;margin-bottom:6px}',
      '.fc-col{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;gap:4px}',
      '.fc-col-n{font-size:10.5px;color:' + FG2 + ';min-height:14px;font-variant-numeric:tabular-nums}',
      '.fc-col-bar{flex:1;width:100%;max-width:28px;display:flex;align-items:flex-end;border-radius:7px;' + GLASS_SOFT + ';overflow:hidden}',
      '.fc-col-bar i{display:block;width:100%;border-radius:7px;background:' + tint(ERR, 55) + ';transition:height .3s}',
      '.fc-col.is-today .fc-col-bar i{background:var(' + ERR + ')}',
      '.fc-col-d{font-size:11px;color:' + FG2 + '}',
      '.fc-col.is-today .fc-col-d{color:' + FG + ';font-weight:650}',
      '.fc-sub{margin:14px 0 6px;font-size:12px;font-weight:600;color:' + FG2 + '}',
      '.fc-tasks,.fc-recent{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}',
      '.fc-tasks li,.fc-recent li{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:9px;font-size:12.5px}',
      '.fc-recent li:hover{' + GLASS_SOFT + '}',
      '.fc-task-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.fc-recent-time{color:' + FG2 + ';font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.fc-dot{width:8px;height:8px;border-radius:50%;background:var(' + ERR + ');flex:none}',
      '.fc-dot.is-partial{background:transparent;border:1.5px solid var(' + ERR + ')}',
      '.fc-del{opacity:0}',
      '.fc-recent li:hover .fc-del,.fc-del:focus-visible{opacity:1}',
      '.fc-none{margin:0;font-size:12.5px}',
      '.fc-nums{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-bottom:6px}',
      '.fc-num{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px}',
      '.fc-num .lp-field input{width:44px;text-align:right}',
      '@media (max-width:860px){.fc-grid{grid-template-columns:1fr}}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'focus: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 27, label: () => t('panel'), locale: NS,
        }, FocusIcon));
        // Keep the timer state current even while the panel is closed, so the chime, white noise and
        // sidebar dot follow a session the agent started from chat.
        ctx.effect(() => {
          refresh();
          const id = setInterval(refresh, 60000);
          return () => {
            clearInterval(id); clearTimeout(ctl.endTimer);
            teardownSource(0);
            if (noise.ctx) { try { noise.ctx.close(); } catch {} }
            noise.ctx = null; noise.master = null; noise.playing = false; noise.buffers.clear();
            ctl.listeners.clear();
          };
        }, 'focus: timer sync and audio cleanup');
      },
    };
  },
});
