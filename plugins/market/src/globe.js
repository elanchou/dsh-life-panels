    /* ===== Globe: three.js from the plugin's own route; land as an even dot lattice, exchanges as glowing pins ===== */
    const API_BASE = '/plugin-api/market';
    let threePromise = null;
    let landPromise = null;
    function loadThree() {
      if (window.THREE) return Promise.resolve(window.THREE);
      if (!threePromise) {
        threePromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = API_BASE + '/three.js';
          s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('three.js missing')));
          s.onerror = () => { threePromise = null; reject(new Error('three.js failed to load')); };
          document.head.appendChild(s);
        });
      }
      return threePromise;
    }
    function loadLand() {
      if (!landPromise) {
        landPromise = fetch(API_BASE + '/land.json', { cache: 'force-cache' }).then((r) => { if (!r.ok) throw new Error('map HTTP ' + r.status); return r.json(); })
          .catch((e) => { landPromise = null; throw e; });
      }
      return landPromise;
    }

    const PIN = { up: 0x16a34a, down: 0xe5484d, flat: 0x6b8fd6, closed: 0x9aa8c2 };
    const DEG = Math.PI / 180;
    /** Point on the unit sphere for a latitude and longitude in degrees (x right, y up, z toward the viewer at lon 0). */
    const toXYZ = (lat, lon, r = 1) => [r * Math.cos(lat * DEG) * Math.sin(lon * DEG), r * Math.sin(lat * DEG), r * Math.cos(lat * DEG) * Math.cos(lon * DEG)];
    /** Where the sun is overhead right now: [lat, lon] in degrees. */
    function subsolar(now = new Date()) {
      const start = Date.UTC(now.getUTCFullYear(), 0, 0);
      const day = Math.floor((now.getTime() - start) / 86400000);
      const dec = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
      const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
      return [dec, (12 - hours) * 15];
    }
    function glowTexture(THREE, ring) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      if (ring) { grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.62, 'rgba(255,255,255,0)'); grad.addColorStop(0.8, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); }
      else { grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); }
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    }
    /** Latitude and longitude lines, every 30 degrees. */
    function graticule(THREE) {
      const pts = [];
      const add = (a, b) => { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
      for (let lat = -60; lat <= 60; lat += 30) for (let lon = 0; lon < 360; lon += 4) add(toXYZ(lat, lon, 1.002), toXYZ(lat, lon + 4, 1.002));
      for (let lon = 0; lon < 360; lon += 30) for (let lat = -88; lat < 88; lat += 4) add(toXYZ(lat, lon, 1.002), toXYZ(lat + 4, lon, 1.002));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      return geo;
    }

    const BASE_VS = 'varying vec3 vL; varying vec3 vN; void main(){ vL = normalize(position); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
    const BASE_FS = 'uniform vec3 uSun; uniform vec3 uDayC; uniform vec3 uNightC; uniform vec3 uRimC; uniform float uRimK; varying vec3 vL; varying vec3 vN; void main(){'
      + ' float day = smoothstep(-0.25, 0.4, dot(vL, uSun));'
      + ' vec3 c = mix(uNightC, uDayC, day);'
      + ' float rim = pow(1.0 - max(vN.z, 0.0), 2.4);'
      + ' c = mix(c, uRimC, rim*uRimK);'
      + ' gl_FragColor = vec4(c, 1.0); }';
    const LAND_VS = 'uniform vec3 uSun; uniform float uSize; uniform float uPx; varying float vDay; varying float vFace;'
      + ' void main(){ vec3 n = normalize(position); vDay = smoothstep(-0.2, 0.35, dot(n, uSun)); vFace = normalize(normalMatrix*n).z;'
      + ' vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = uSize*uPx/(-mv.z); gl_Position = projectionMatrix*mv; }';
    const LAND_FS = 'uniform vec3 uLandDay; uniform vec3 uLandNight; varying float vDay; varying float vFace; void main(){'
      + ' float d = length(gl_PointCoord-0.5); if (d>0.5) discard;'
      + ' float edge = smoothstep(0.5, 0.25, d);'
      + ' float a = edge*mix(0.7,1.0,vDay)*smoothstep(-0.05,0.35,vFace);'
      + ' gl_FragColor = vec4(mix(uLandNight, uLandDay, vDay), a); }';

    /**
     * Builds the scene inside `el` and returns { update, focus, dispose }. The globe is always drawn for a dark
     * backdrop (the stage card paints one), so it looks the same in light and dark themes.
     * cb: { hover(id|null), pick(id), moveTip(x, y) } are called from pointer events and the render loop.
     */
    function buildGlobe(THREE, land, el, cb) {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Light by default: a white planet with slate land dots and a thin grey rim on the page's own white. In a dark theme it turns into a night globe.
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(el).color || '');
      const dark = m ? (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) > 140 : false;
      const pal = dark
        ? { day: [0.075, 0.135, 0.26], night: [0.03, 0.055, 0.115], rim: [0.2, 0.42, 0.85], rimK: 0.35, landDay: [0.66, 0.82, 1.0], landNight: [0.3, 0.4, 0.62], grid: 0x5f8dff, gridA: 0.1, add: true }
        : { day: [1, 1, 1], night: [0.955, 0.96, 0.97], rim: [0.8, 0.82, 0.86], rimK: 0.85, landDay: [0.2, 0.24, 0.32], landNight: [0.52, 0.56, 0.64], grid: 0xb8bfcc, gridA: 0.35, add: false };
      const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(el.clientWidth || 400, el.clientHeight || 400);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = 'mk-canvas';
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, (el.clientWidth || 1) / (el.clientHeight || 1), 0.1, 30);
      camera.position.z = 4.5;
      const globe = new THREE.Group();
      scene.add(globe);
      const disposables = [];
      const track = (x) => { disposables.push(x); return x; };
      const sun = new THREE.Vector3(1, 0, 0);
      const pxFor = () => (renderer.domElement.height / (2 * Math.tan((camera.fov * DEG) / 2)));

      // Halo behind the planet.
      const haloTex = track(glowTexture(THREE, false));
      if (dark) {
        const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: haloTex, color: 0x3b82f6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
        halo.scale.setScalar(3.4); halo.position.z = -0.3; halo.renderOrder = -2;
        scene.add(halo);
      }

      // The planet: deep blue, lit on the day side, with a soft blue rim.
      const baseMat = track(new THREE.ShaderMaterial({ uniforms: { uSun: { value: sun }, uDayC: { value: v3(pal.day) }, uNightC: { value: v3(pal.night) }, uRimC: { value: v3(pal.rim) }, uRimK: { value: pal.rimK } }, vertexShader: BASE_VS, fragmentShader: BASE_FS }));
      globe.add(new THREE.Mesh(track(new THREE.SphereGeometry(0.995, 96, 64)), baseMat));

      globe.add(new THREE.LineSegments(track(graticule(THREE)), track(new THREE.LineBasicMaterial({ color: pal.grid, transparent: true, opacity: pal.gridA, depthWrite: false }))));

      // Land: one soft dot per lattice point that falls on land; brighter on the day side.
      const pts = land.points || [];
      const pos = new Float32Array((pts.length / 2) * 3);
      for (let i = 0; i < pts.length; i += 2) pos.set(toXYZ(pts[i] * land.unit, pts[i + 1] * land.unit, 1.004), (i / 2) * 3);
      const landGeo = track(new THREE.BufferGeometry());
      landGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const landMat = track(new THREE.ShaderMaterial({
        uniforms: { uSun: { value: sun }, uSize: { value: 0.0155 }, uPx: { value: pxFor() }, uLandDay: { value: v3(pal.landDay) }, uLandNight: { value: v3(pal.landNight) } },
        vertexShader: LAND_VS, fragmentShader: LAND_FS, transparent: true, depthWrite: false,
      }));
      globe.add(new THREE.Points(landGeo, landMat));

      const setSun = () => { const [la, lo] = subsolar(); const v = toXYZ(la, lo); sun.set(v[0], v[1], v[2]); };
      setSun();

      // Pins: a glow, a dot, a pulsing ring while the market is open, and an invisible sphere to hit.
      const pins = new Map();
      const hitMeshes = [];
      const ringTex = track(glowTexture(THREE, true));
      const ensurePin = (ex) => {
        let p = pins.get(ex.id);
        if (p) return p;
        const at = toXYZ(ex.lat, ex.lon, 1.012);
        const dot = new THREE.Mesh(track(new THREE.SphereGeometry(0.016, 20, 14)), track(new THREE.MeshBasicMaterial({ color: PIN.closed })));
        const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: haloTex, color: PIN.closed, transparent: true, opacity: 0, depthWrite: false, blending: pal.add ? THREE.AdditiveBlending : THREE.NormalBlending })));
        const ring = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: ringTex, color: PIN.closed, transparent: true, opacity: 0, depthWrite: false, blending: pal.add ? THREE.AdditiveBlending : THREE.NormalBlending })));
        const hit = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 8, 6)), track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
        for (const o of [dot, glow, ring, hit]) o.position.set(at[0], at[1], at[2]);
        hit.userData.id = ex.id;
        globe.add(dot, glow, ring, hit);
        hitMeshes.push(hit);
        p = { dot, glow, ring, hit, open: false, selected: false, phase: Math.random() };
        pins.set(ex.id, p);
        return p;
      };
      const update = (list, selectedId) => {
        for (const ex of list) {
          const p = ensurePin(ex);
          const pct = ex.quote ? ex.quote.pct : null;
          const color = ex.state === 'open' ? (pct > 0 ? PIN.up : pct < 0 ? PIN.down : PIN.flat) : ex.state === 'lunch' ? PIN.flat : PIN.closed;
          p.dot.material.color.setHex(color); p.glow.material.color.setHex(color); p.ring.material.color.setHex(color);
          p.open = ex.state === 'open'; p.state = ex.state; p.selected = ex.id === selectedId;
        }
      };

      // Rotation: the group's Euler angles; focus() eases them toward a target. Starts facing the user's own longitude.
      const rot = { y: -(-new Date().getTimezoneOffset() / 60) * 15 * DEG, x: 0.38, vy: 0, vx: 0 };
      const target = { y: null, x: null };
      let dragging = false; let moved = 0; let lastX = 0; let lastY = 0; let idleAt = 0; let hoverId = null; let visible = true; let raf = 0;
      const focus = (lat, lon) => { target.y = -lon * DEG; target.x = Math.max(-1.0, Math.min(1.0, lat * DEG * 0.8)); };
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const baseMesh = globe.children[0];
      const pickAt = (clientX, clientY) => {
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects([baseMesh, ...hitMeshes], false);
        return hits.length && hits[0].object.userData.id ? hits[0].object.userData.id : null;
      };
      const canvas = renderer.domElement;
      const onDown = (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; target.y = null; target.x = null; try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ } canvas.style.cursor = 'grabbing'; };
      const onMove = (e) => {
        if (dragging) {
          const dx = e.clientX - lastX; const dy = e.clientY - lastY;
          moved += Math.abs(dx) + Math.abs(dy); lastX = e.clientX; lastY = e.clientY;
          rot.vy = dx * 0.0052; rot.vx = dy * 0.0052; rot.y += rot.vy; rot.x = Math.max(-1.2, Math.min(1.2, rot.x + rot.vx));
          idleAt = performance.now();
          return;
        }
        if (e.pointerType === 'mouse') { const id = pickAt(e.clientX, e.clientY); if (id !== hoverId) { hoverId = id; cb.hover(id); canvas.style.cursor = id ? 'pointer' : 'grab'; } }
      };
      const onUp = (e) => {
        dragging = false; canvas.style.cursor = hoverId ? 'pointer' : 'grab';
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* released */ }
        if (moved < 5) { const id = pickAt(e.clientX, e.clientY); if (id) cb.pick(id); }
        idleAt = performance.now();
      };
      const onLeave = () => { if (hoverId) { hoverId = null; cb.hover(null); } };
      canvas.style.cursor = 'grab'; canvas.style.touchAction = 'pan-y';
      canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('pointerleave', onLeave);

      const resize = () => {
        const w = el.clientWidth; const h = el.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 40 : 30; camera.updateProjectionMatrix();
        landMat.uniforms.uPx.value = pxFor();
      };
      const ro = new ResizeObserver(resize); ro.observe(el);
      resize();
      const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.01 }); io.observe(el);
      const sunTimer = setInterval(setSun, 60000);
      const tmp = new THREE.Vector3();
      const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        if (target.y !== null) {
          rot.y += angleDiff(rot.y, target.y) * 0.09; rot.x += (target.x - rot.x) * 0.09;
          if (Math.abs(angleDiff(rot.y, target.y)) < 0.002 && Math.abs(target.x - rot.x) < 0.002) { target.y = null; target.x = null; idleAt = now; }
        } else if (!dragging) {
          rot.y += rot.vy; rot.vy *= 0.94; rot.x = Math.max(-1.2, Math.min(1.2, rot.x + rot.vx)); rot.vx *= 0.9;
          if (!reduced && !hoverId && now - idleAt > 2500) rot.y += 0.0016;
        }
        globe.rotation.set(rot.x, rot.y, 0);
        const t = now / 1000;
        for (const p of pins.values()) {
          const k = p.selected ? 1.6 : 1;
          p.dot.scale.setScalar(k);
          p.glow.scale.setScalar(p.open ? 0.1 * k : 0.055 * k);
          p.glow.material.opacity = pal.add ? (p.open ? 0.7 : p.selected ? 0.5 : 0.14) : (p.open ? 0.35 : p.selected ? 0.3 : 0.0);
          if (p.open) { const s = (t * 0.6 + p.phase) % 1; p.ring.scale.setScalar(0.05 + s * 0.13 * k); p.ring.material.opacity = (1 - s) * 0.9; }
          else if (p.selected) { p.ring.scale.setScalar(0.1); p.ring.material.opacity = 0.6; }
          else p.ring.material.opacity = 0;
        }
        if (hoverId) {
          const p = pins.get(hoverId);
          if (p) {
            tmp.copy(p.dot.position); globe.localToWorld(tmp); tmp.project(camera);
            const r = canvas.getBoundingClientRect();
            cb.moveTip(((tmp.x + 1) / 2) * r.width, ((1 - tmp.y) / 2) * r.height);
          }
        }
        renderer.render(scene, camera);
      };
      idleAt = performance.now();
      raf = requestAnimationFrame(frame);

      const dispose = () => {
        cancelAnimationFrame(raf); clearInterval(sunTimer); ro.disconnect(); io.disconnect();
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave);
        for (const d of disposables) { try { d.dispose(); } catch { /* already gone */ } }
        renderer.dispose();
        try { renderer.forceContextLoss(); } catch { /* not supported */ }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
      return { update, focus, dispose, canvas };
    }
