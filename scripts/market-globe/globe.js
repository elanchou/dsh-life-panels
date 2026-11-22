import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, Line,
  ColorManagement, LinearSRGBColorSpace, LineBasicMaterial, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Quaternion, RingGeometry, Scene,
  ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer,
} from 'three';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import landTopo from 'world-atlas/land-110m.json';

ColorManagement.enabled = false;
const RAD = Math.PI / 180;
const lonLat = (lat, lon, r = 1) => new Vector3(
  r * Math.cos(lat * RAD) * Math.sin(lon * RAD), r * Math.sin(lat * RAD), r * Math.cos(lat * RAD) * Math.cos(lon * RAD));

/** Land as evenly spaced dots: rasterise the 110m land polygon, then sample a lat/lon grid. */
function landPositions() {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const projection = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  c.fillStyle = '#fff';
  c.beginPath();
  geoPath(projection, c)(feature(landTopo, landTopo.objects.land));
  c.fill();
  const px = c.getImageData(0, 0, W, H).data;
  const out = [];
  const step = 1.05;
  for (let lat = -80; lat <= 84; lat += step) {
    const lonStep = step / Math.max(Math.cos(lat * RAD), 0.15);
    for (let lon = -180; lon < 180; lon += lonStep) {
      const x = Math.min(W - 1, Math.floor((lon + 180) / 360 * W));
      const y = Math.min(H - 1, Math.floor((90 - lat) / 180 * H));
      if (px[(y * W + x) * 4 + 3] > 128) { const v = lonLat(lat, lon, 1.002); out.push(v.x, v.y, v.z); }
    }
  }
  return new Float32Array(out);
}

const SPHERE_VERT = `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SPHERE_FRAG = `uniform vec3 uBase; varying vec3 vN;
void main(){ gl_FragColor = vec4(uBase, 1.0); }`;
const DOT_VERT = `uniform float uSize; varying float vFade;
void main(){ vec3 n = normalize(normalMatrix * position); vFade = smoothstep(0.0, 0.45, n.z);
  gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const DOT_FRAG = `uniform vec3 uColor; uniform float uAlpha; varying float vFade;
void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(uColor, uAlpha * vFade * smoothstep(0.5, 0.32, r)); }`;

/** Resolve any CSS colour (var(), oklch(), rgb()) to a three.js Color by letting the browser compute it. */
function makeColorReader(host) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const g = px.getContext('2d', { willReadFrequently: true });
  return {
    read(expr, fallback) {
      try {
        probe.style.color = '';
        probe.style.color = expr;
        g.clearRect(0, 0, 1, 1);
        g.fillStyle = '#000';
        g.fillStyle = getComputedStyle(probe).color;
        g.fillRect(0, 0, 1, 1);
        const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
        return new Color(r / 255, gg / 255, b / 255);
      } catch { return new Color(fallback); }
    },
    dispose() { probe.remove(); },
  };
}

export function createGlobe(container, { onSelect }) {
  let renderer;
  try { renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch { return null; }
  if (!renderer.getContext()) return null;

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 3));
  renderer.domElement.className = 'mkd-gl-canvas';
  container.appendChild(renderer.domElement);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'mkd-gl-layer';
  container.appendChild(labelLayer);
  const colors = makeColorReader(container);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  const globe = new Group();
  scene.add(globe);

  const sphereMat = new ShaderMaterial({ vertexShader: SPHERE_VERT, fragmentShader: SPHERE_FRAG, uniforms: { uBase: { value: new Color() } } });
  globe.add(new Mesh(new SphereGeometry(1, 64, 48), sphereMat));

  const landGeo = new BufferGeometry();
  landGeo.setAttribute('position', new BufferAttribute(landPositions(), 3));
  const landMat = new ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false, uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0.95 }, uSize: { value: 2.4 * renderer.getPixelRatio() } } });
  globe.add(new Points(landGeo, landMat));

  const gratMat = new LineBasicMaterial({ transparent: true, opacity: 0.12 });
  const gratGeos = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 5) pts.push(lonLat(lat, lon, 1.001));
    gratGeos.push(new BufferGeometry().setFromPoints(pts));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 5) pts.push(lonLat(lat, lon, 1.001));
    gratGeos.push(new BufferGeometry().setFromPoints(pts));
  }
  gratGeos.forEach((g) => globe.add(new Line(g, gratMat)));

  // A bar of unit height standing on the surface; vertex colours fade it from dim at the base to full at the top.
  const stemGeo = new CylinderGeometry(0.012, 0.012, 1, 24, 1).translate(0, 0.5, 0);
  {
    const pos = stemGeo.getAttribute('position');
    const shade = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = 0.38 + 0.62 * pos.getY(i); shade.set([k, k, k], i * 3); }
    stemGeo.setAttribute('color', new BufferAttribute(shade, 3));
  }
  const ringGeo = new RingGeometry(0.02, 0.026, 40);
  const ringMat = new MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, blending: AdditiveBlending });
  const ring = new Mesh(ringGeo, ringMat);
  ring.visible = false;
  globe.add(ring);

  const palette = { up: new Color('#e5484d'), dn: new Color('#2ea36b'), mute: new Color('#8b97a6') };
  function refreshColors() {
    const bg = colors.read('var(--dsw-alias-bg-layer-1)', '#161b22');
    const fg = colors.read('var(--dsw-alias-label-secondary)', '#8b97a6');
    palette.up = colors.read('var(--mkd-up)', '#e5484d');
    palette.dn = colors.read('var(--mkd-dn)', '#2ea36b');
    palette.mute = fg;
    sphereMat.uniforms.uBase.value.copy(colors.read('var(--dsw-alias-bg-base)', '#0e1116'));
    landMat.uniforms.uColor.value.copy(fg);
    gratMat.color.copy(fg);
    markers.forEach(paint);
  }

  const markers = new Map();
  const stemQuat = new Quaternion();
  const up = new Vector3(0, 1, 0);
  let selected = '';
  let hovered = '';

  function paint(m) {
    const c = m.pct == null ? palette.mute : m.pct >= 0 ? palette.up : palette.dn;
    m.mat.color.copy(c);
    m.el.className = 'mkd-gl ' + (m.pct == null ? '' : m.pct >= 0 ? 'mkd-up' : 'mkd-dn');
    const h = 0.04 + Math.min(Math.abs(m.pct ?? 0), 4) / 4 * 0.17;
    m.stem.scale.y = h;
    m.tip.copy(m.normal).multiplyScalar(1 + h);
  }

  function setData(list, sel) {
    selected = sel;
    for (const item of list) {
      let m = markers.get(item.symbol);
      if (!m) {
        const normal = lonLat(item.lat, item.lon).normalize();
        const mat = new MeshBasicMaterial({ vertexColors: true });
        const stem = new Mesh(stemGeo, mat);
        stem.position.copy(normal);
        stem.quaternion.copy(stemQuat.setFromUnitVectors(up, normal));
        globe.add(stem);
        const el = document.createElement('div');
        labelLayer.appendChild(el);
        m = { symbol: item.symbol, lat: item.lat, lon: item.lon, normal, mat, stem, el, tip: new Vector3(), pct: null, w: 0, h: 0, sx: 0, sy: 0, vis: false };
        markers.set(item.symbol, m);
      }
      m.pct = item.pct;
      m.name = item.name;
      m.el.textContent = '';
      const n = document.createElement('span');
      n.textContent = item.name;
      const p = document.createElement('b');
      p.textContent = item.pct == null ? '' : (item.pct >= 0 ? '+' : '') + item.pct.toFixed(2) + '%';
      m.el.append(n, p);
      m.w = 0;
      paint(m);
    }
    markers.forEach((m) => { const on = m.symbol === selected; m.stem.scale.x = m.stem.scale.z = on ? 1.5 : 1; });
  }

  let rotY = -100 * RAD, rotX = 0.28, velY = 0, size = { w: 1, h: 1 }, focus = null;
  let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, pointer = null;

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the sphere to the smaller dimension so it is never clipped on narrow containers.
    camera.position.set(0, 0, 1.0 / (0.94 * Math.min(1, w / h) * Math.tan(15 * RAD)));
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const tmp = new Vector3();
  function nearest(x, y, max) {
    let best = null, bd = max * max;
    markers.forEach((m) => { if (!m.vis) return; const d = (m.sx - x) ** 2 + (m.sy - y) ** 2; if (d < bd) { bd = d; best = m; } });
    return best;
  }
  const local = (e) => { const r = container.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => { dragging = true; dragMoved = 0; [lastX, lastY] = local(e); velY = 0; focus = null; container.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    const [x, y] = local(e);
    pointer = [x, y];
    if (dragging) {
      const dx = x - lastX, dy = y - lastY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      rotY += dx * 0.006; rotX = Math.max(-1, Math.min(1, rotX + dy * 0.004)); velY = dx * 0.006;
      lastX = x; lastY = y;
    }
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    container.releasePointerCapture?.(e.pointerId);
    if (dragMoved < 5) {
      const [x, y] = local(e);
      const m = nearest(x, y, 18);
      if (m) { focus = { y: -m.lon * RAD, x: Math.max(-0.7, Math.min(0.7, m.lat * RAD * 0.7)) }; onSelect(m.symbol); }
    }
  };
  const onLeave = () => { pointer = null; };
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);
  container.addEventListener('pointerleave', onLeave);

  let raf = 0, last = performance.now(), frame = 0, visible = true, disposed = false;
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; schedule(); });
  io.observe(container);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);

  function tick(now) {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (frame++ % 120 === 0) refreshColors();
    hovered = '';
    if (!dragging && pointer) { const m = nearest(pointer[0], pointer[1], 16); if (m) hovered = m.symbol; }
    container.style.cursor = hovered ? 'pointer' : dragging ? 'grabbing' : 'grab';

    if (focus) {
      let dy = focus.y - rotY;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const k = 1 - Math.exp(-dt * 5);
      rotY += dy * k; rotX += (focus.x - rotX) * k;
      if (Math.abs(dy) < 0.002) focus = null;
    } else if (!dragging) {
      rotY += velY; velY *= 0.92;
      if (!reduced && !hovered && Math.abs(velY) < 0.0005) rotY += dt * 0.1;
    }
    globe.rotation.set(rotX, rotY, 0);
    globe.updateMatrixWorld(true);

    const placed = [];
    const order = [...markers.values()].sort((a, b) => (b.symbol === selected) - (a.symbol === selected) || (b.symbol === hovered) - (a.symbol === hovered));
    for (const m of order) {
      tmp.copy(m.tip).applyMatrix4(globe.matrixWorld);
      const z = tmp.z;
      tmp.project(camera);
      m.sx = (tmp.x * 0.5 + 0.5) * size.w;
      m.sy = (-tmp.y * 0.5 + 0.5) * size.h;
      m.vis = z > 0.12;
      let show = m.vis;
      if (show) {
        if (!m.w) { m.w = m.el.offsetWidth || 90; m.h = m.el.offsetHeight || 20; }
        const r = [m.sx + 8, m.sy - m.h / 2, m.sx + 8 + m.w, m.sy + m.h / 2];
        const forced = m.symbol === selected || m.symbol === hovered;
        if (!forced && placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) show = false;
        else placed.push(r);
      }
      m.el.style.transform = `translate(${m.sx + 8}px, ${m.sy - m.h / 2}px)`;
      m.el.style.opacity = show ? String(Math.min(1, (z - 0.12) * 4)) : '0';
      m.el.dataset.active = m.symbol === selected || m.symbol === hovered ? '1' : '';
    }

    const sm = markers.get(selected);
    ring.visible = !!sm;
    if (sm) {
      ring.position.copy(sm.normal).multiplyScalar(1.004);
      ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), sm.normal);
      const s = 1 + ((now / 1000) % 1.6) / 1.6 * 1.6;
      ring.scale.setScalar(s);
      ringMat.opacity = 0.8 * (1 - ((now / 1000) % 1.6) / 1.6);
      ringMat.color.copy(sm.mat.color);
    }
    renderer.render(scene, camera);
    schedule();
  }
  function schedule() {
    if (!raf && !disposed && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  refreshColors();
  schedule();

  return {
    setData,
    refreshColors,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'].forEach((n) => container.removeEventListener(n, { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp, pointerleave: onLeave }[n]));
      [sphereMat, landMat, gratMat, ringMat].forEach((m) => m.dispose());
      [landGeo, stemGeo, ringGeo, ...gratGeos].forEach((g) => g.dispose());
      markers.forEach((m) => m.mat.dispose());
      scene.traverse((o) => o.geometry?.dispose?.());
      colors.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
