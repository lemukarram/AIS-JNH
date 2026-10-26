// Tiny pub/sub store: single source of truth for every screen.
const subs = new Map();
const state = {
  user: null,
  preset: 'cafe',
  lang: 'en',
  theme: 'dark',
  brand: { name: 'SENTRA', venue: '', accent: '#C6F432', logo: '' },
  now: Date.now(),
  speed: 1,
  kpi: {},          // live KPIs from engine
  cams: [],         // camera runtime state
  alerts: [],       // newest first
  hourly: [],       // 24 buckets today
  zones: [],
  flags: { boxes: true, trails: true, zones: true, heat: false, blur: false, skeleton: false },
};
export const get = () => state;
export function set(patch, topic = Object.keys(patch)[0]) {
  Object.assign(state, patch);
  emit(topic);
}
export function emit(topic) {
  (subs.get(topic) || []).forEach(fn => fn(state));
  (subs.get('*') || []).forEach(fn => fn(state, topic));
}
export function on(topic, fn) {
  if (!subs.has(topic)) subs.set(topic, new Set());
  subs.get(topic).add(fn);
  return () => subs.get(topic).delete(fn);
}
// persisted per-viewer preferences
export const pref = {
  read(k, d) { try { const v = localStorage.getItem('sentra.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  write(k, v) { try { localStorage.setItem('sentra.' + k, JSON.stringify(v)); } catch {} },
};
// deterministic RNG (mulberry32) so history is identical every load
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
