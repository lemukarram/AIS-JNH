// Pipeline C: seeded procedural simulation. Emits the same schema a baked-track replay would.
import { get, set, emit, rng } from './store.js';
import { PRESETS, ALERT_CAM } from './presets.js';

const SCALE = { door: [.07, .2], queue: [.07, .2], seating: [.06, .17], kitchen: [.08, .22], bar: [.07, .2], corridor: [.06, .22], parking: [.1, .14] };
let R = rng(20260);
let cams = [], preset, tickId, idSeq = 100, alertSeq = 1, nextRandomAt = 0, simT = 0;
const cooldown = {};

// ---- seeded history: believable weekly/daily seasonality, not noise ----
export function hourCurve(h, dow) {
  const peaks = dow === 5 ? [[9, .5], [13, .9], [20, 1]] : [[8, .7], [13, 1], [19, .8]];
  let v = .04;
  for (const [c, a] of peaks) v += a * Math.exp(-((h - c) ** 2) / 5);
  if (h < 6) v *= .15;
  return v;
}
export function dayTotal(date, seed = 1) {
  const r = rng(date.getFullYear() * 400 + date.getMonth() * 31 + date.getDate() + seed);
  const dow = date.getDay();
  const week = [.85, .8, .8, .85, .95, 1.25, 1.15][dow];
  const weather = r() < .08 ? .62 : 1;
  const promo = r() < .06 ? 1.4 : 1;
  return Math.round(preset.capacity * 3.1 * week * weather * promo * (.92 + r() * .16));
}
export function history(days = 90) {
  const out = []; const now = new Date();
  for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); out.push({ date: d, total: dayTotal(d) }); }
  return out;
}
export function hourlyFor(date) {
  const dow = date.getDay(), tot = dayTotal(date);
  const w = Array.from({ length: 24 }, (_, h) => hourCurve(h, dow)); const s = w.reduce((a, b) => a + b, 0);
  return w.map(x => Math.round(x / s * tot));
}
const simHour = () => { const d = new Date(get().now); return d.getHours() + d.getMinutes() / 60; };

// ---- lifecycle ----
export function boot(presetId = 'cafe') {
  stop();
  preset = PRESETS[presetId]; R = rng(777 + presetId.length);
  idSeq = 100; alertSeq = 1; simT = 0;
  cams = preset.cameras.map((def, i) => ({
    def, i, agents: [], in: 0, out: 0, fps: 28, latency: 120, bitrate: 1800 + i * 210, online: true, reconnectUntil: 0,
    queue: 0, flash: 0,
  }));
  const zones = cams.flatMap(c => c.def.zones.map(z => ({ cam: c.def.id, ...z })));
  const s = get();
  s.now = Date.now();
  set({ preset: presetId, cams, zones, alerts: [], hourly: hourlyFor(new Date()) }, 'preset');
  for (let k = 0; k < 160; k++) step(.25, true);   // warm start so first paint already has people
  cams.forEach(c => { c.in = 0; c.out = 0; });
  s.kpi = kpis();
  nextRandomAt = simT + 6;
  tickId = setInterval(() => step(.1 * get().speed), 100);
  emit('booted');
}
export function stop() { clearInterval(tickId); }
export const getCams = () => cams;
export const getPreset = () => preset;

function spawn(c) {
  const d = c.def, r = d.routes[Math.floor(R() * d.routes.length)], s = d.spawn[Math.floor(R() * d.spawn.length)];
  const jitter = (R() - .5) * .08;
  c.agents.push({
    id: ++idSeq, cls: d.cls === 'car' ? 'car' : (R() < .05 ? 'bag' : 'person'), staff: !!d.staff,
    x: s[0] + jitter, y: s[1], route: r, wp: 0, wait: 0, speed: (d.cls === 'car' ? .14 : .06 + R() * .05), conf: .62 + R() * .35,
    trail: [], side: null, box: SCALE[d.scene] || [.07, .2], hue: R(),
  });
}

function step(dt, quiet) {
  simT += dt;
  const st = get();
  if (!quiet) st.now += dt * 1000;
  const hf = (get().traffic ?? 1) * hourCurve(simHour(), new Date(st.now).getDay()) * 1.6 * preset.baseRate + .25;
  for (const c of cams) {
    if (c.reconnectUntil && simT > c.reconnectUntil) { c.reconnectUntil = 0; c.online = true; }
    if (!c.reconnectUntil && !quiet && c.i === 3 && R() < .0006) { c.online = false; c.reconnectUntil = simT + 4; }
    if (!c.online) continue;
    if (c.agents.length < 16 && R() < c.def.rate * hf * dt * .9) spawn(c);
    for (const a of c.agents) move(c, a, dt);
    c.agents = c.agents.filter(a => !a.done);
    c.fps = 24 + Math.round((Math.sin(simT / 3 + c.i) * .5 + .5 + R() * .3) * 6);
    c.latency = Math.round(80 + (Math.sin(simT / 5 + c.i * 2) * .5 + .5) * 100 + R() * 40);
    const qz = c.def.zones.find(z => z.kind === 'queue');
    c.queue = qz ? c.agents.filter(a => a.cls === 'person' && inRect(a, qz)).length : 0;
    c.flash = Math.max(0, c.flash - dt);
  }
  if (quiet) return;
  rules();
  const k = kpis();
  k.alerts = st.alerts.filter(a => a.status === 'new').length;
  st.kpi = k;
  emit('tick');
}

function inRect(a, z) { return a.x >= z.x && a.x <= z.x + z.w && a.y >= z.y && a.y <= z.y + z.h; }

function move(c, a, dt) {
  const d = c.def;
  if (a.wait > 0) { a.wait -= dt; return; }
  const wp = a.route[a.wp];
  if (!wp) { a.done = true; return; }
  const dx = wp[0] - a.x, dy = wp[1] - a.y, dist = Math.hypot(dx, dy);
  const sp = a.speed * dt;
  if (dist < sp * 1.2) {
    a.x = wp[0]; a.y = wp[1];
    if (wp[2]) a.wait = wp[2] / 1000 * (.6 + R() * .8);
    a.wp++;
    if (a.wp >= a.route.length) a.done = true;
    return;
  }
  a.x += dx / dist * sp + (R() - .5) * .0015; a.y += dy / dist * sp + (R() - .5) * .0015;
  a.conf = Math.min(.99, Math.max(.5, a.conf + (R() - .5) * .02));
  if (R() < .0008) a.id = ++idSeq;     // occasional track-ID re-acquisition
  a.trail.push([a.x, a.y]); if (a.trail.length > 28) a.trail.shift();
  if (d.line) {
    const [x1, y1] = d.line.a, [x2, y2] = d.line.b;
    const side = Math.sign((x2 - x1) * (a.y - y1) - (y2 - y1) * (a.x - x1));
    if (a.side !== null && side !== a.side && side !== 0) {
      if (side < 0) c.in++; else c.out++;
      c.flash = .6;
    }
    a.side = side;
  }
}

function kpis() {
  const st = get(), d = new Date(st.now), h = d.getHours();
  const entr = cams[0];
  const baseInside = Math.round(preset.capacity * Math.min(.85, hourCurve(h + d.getMinutes() / 60, d.getDay()) * .7));
  const inside = Math.max(0, baseInside + entr.in - entr.out);
  let before = 0; for (let i = 0; i < h; i++) before += st.hourly[i];
  const footfall = before + Math.round(st.hourly[h] * d.getMinutes() / 60) + entr.in;
  const qc = cams.find(c => c.def.zones.some(z => z.kind === 'queue'));
  const queue = qc ? qc.queue : 0;
  const peakH = st.hourly.reduce((b, v, i) => v > st.hourly[b] ? i : b, 0);
  return {
    inside, footfall, queue, waiting: queue + Math.round(inside * .18), wait: Math.round((queue * 52 / 60 + 1.2) * 10) / 10,
    occupancy: Math.min(100, Math.round(inside / preset.capacity * 100)),
    dwell: Math.round(26 + Math.sin(simT / 90) * 3 + (preset.id === 'hospital' ? 34 : 0)),
    restricted: st.alerts.filter(a => a.type === 'restricted').length,
    cams: cams.filter(c => c.online).length, camsTotal: cams.length,
    fps: Math.round(cams.reduce((s, c) => s + c.fps, 0) / cams.length),
    latency: Math.round(cams.reduce((s, c) => s + c.latency, 0) / cams.length),
    peakHour: peakH, alerts: 0, capacity: preset.capacity,
    yesterday: dayTotal(new Date(Date.now() - 864e5)),
  };
}

// ---- alerts ----
function rules() {
  const qc = cams.find(c => c.def.zones.some(z => z.kind === 'queue'));
  const limit = get().queueLimit ?? 5;
  if (qc && qc.queue >= limit && ready('queue', 45)) raise(preset.id === 'hospital' ? 'crowd' : 'queue', { cam: qc, detail: { len: qc.queue } });
  if (simT > nextRandomAt) {
    nextRandomAt = simT + 22 + R() * 30;
    const type = preset.alerts[Math.floor(R() * preset.alerts.length)][0];
    if (ready(type, 30)) raise(type);
  }
}
const ready = (type, secs) => { if ((cooldown[type] || 0) > simT) return false; cooldown[type] = simT + secs; return true; };

export function raise(type, o = {}) {
  if (!o.force && get().modules?.[type] === false) return null;
  const sevMap = Object.fromEntries(preset.alerts.map(([t, s]) => [t, s]));
  const cam = o.cam || cams.find(c => c.def.key === ALERT_CAM[type]) || cams[0];
  const pt = cam.agents[Math.floor(R() * Math.max(1, cam.agents.length))];
  const a = {
    id: alertSeq++, type, sev: sevMap[type] || (type === 'fall' || type === 'restricted' ? 'crit' : 'warn'),
    cam: cam.def.id, camKey: cam.def.key, ts: get().now, status: 'new', assignee: null, notes: [], detail: o.detail || {},
    at: pt ? [pt.x, pt.y] : [.5, .5], conf: Math.round(78 + R() * 20),
  };
  const s = get(); s.alerts.unshift(a); if (s.alerts.length > 200) s.alerts.pop();
  cam.flash = 1.2; cam.lock = { until: simT + 3, at: a.at };
  s.kpi.alerts = s.alerts.filter(x => x.status === 'new').length;
  emit('alerts'); emit('alert:new');
  return a;
}
export function setAlertStatus(id, status) {
  const a = get().alerts.find(x => x.id === id); if (!a) return;
  a.status = status; get().kpi.alerts = get().alerts.filter(x => x.status === 'new').length; emit('alerts');
}
export const simTime = () => simT;

export function addZone(camId, z) { const c = cams.find(x => x.def.id === camId); if (!c) return; c.def.zones.push(z); get().zones.push({ cam: camId, ...z }); emit('zones'); }
export function setLine(camId, line) { const c = cams.find(x => x.def.id === camId); if (!c) return; c.def.line = line; c.in = 0; c.out = 0; c.agents.forEach(a => a.side = null); emit('zones'); }

export function addCamera({ name, scene = 'seating' }) {
  const tpl = PRESETS.cafe.cameras.find(c => c.scene === scene) || PRESETS.cafe.cameras[2];
  const id = 'CAM-0' + (cams.length + 1), key = 'custom' + (cams.length + 1);
  const def = { ...tpl, id, key, label: name, zones: [], line: null, routes: tpl.routes.map(r => r.map(p => [...p])) };
  const c = { def, i: cams.length, agents: [], in: 0, out: 0, fps: 27, latency: 130, bitrate: 2100, online: true, reconnectUntil: 0, queue: 0, flash: 0 };
  cams.push(c); get().cams = cams; emit('zones'); return c;
}
