// Pipeline A: replay baked detections frame-synchronised with sample footage.
// Per camera N (1-based): assets/video/camN.mp4 + assets/tracks/camN.json (see tools/bake_tracks.py).
// If either file is missing or the video can't decode, the camera silently stays on the procedural simulation (pipeline C).
import { get, on } from './store.js';
import { getCams, setReplayHook, raise } from './engine.js';

const BASE = { video: 'assets/video/', tracks: 'assets/tracks/' };

async function probe(cam) {
  const n = cam.i + 1;
  try {
    const r = await fetch(`${BASE.tracks}cam${n}.json`, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;
    const data = await r.json();
    if (!data.frames?.length) return;
    const video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto', src: `${BASE.video}cam${n}.mp4` });
    const rp = { video, data, ready: false, mediaTime: 0, lastT: 0, trails: new Map(), crossings: data.crossings || [], events: data.events || [] };
    video.addEventListener('error', () => { cam.replay = null; });
    video.addEventListener('canplay', () => { rp.ready = true; video.play().catch(() => {}); }, { once: true });
    // frame-accurate clock where supported; otherwise currentTime is read at draw time
    if ('requestVideoFrameCallback' in video) { const cb = (_, m) => { rp.mediaTime = m.mediaTime; video.requestVideoFrameCallback(cb); }; video.requestVideoFrameCallback(cb); }
    cam.replay = rp;
  } catch { /* stay on simulation */ }
}

export function start() {
  for (const c of getCams()) probe(c);
}

// Index of the last frame with t <= time (frames are sorted by t).
function frameAt(frames, time) {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid].t <= time) lo = mid; else hi = mid - 1; }
  return frames[lo];
}
export const clockOf = (rp) => ('requestVideoFrameCallback' in rp.video ? rp.mediaTime : rp.video.currentTime);

// Called by the engine every tick for replay cameras: derives the same state a simulated camera has
// (agents, queue, in/out, alerts) from the baked tracks, so every screen stays consistent.
function sync(cam) {
  const rp = cam.replay; if (!rp?.ready) return false;
  const t = clockOf(rp) || rp.video.currentTime, frame = frameAt(rp.data.frames, t);
  if (t < rp.lastT - .5) { rp.trails.clear(); rp.events.forEach(e => e._fired = false); }   // video looped
  const seen = new Set();
  cam.agents = frame.o.map(o => {
    const [x, y, w, h] = o.b, cx = x + w / 2, cy = y + h;
    let tr = rp.trails.get(o.id); if (!tr) rp.trails.set(o.id, tr = []);
    tr.push([cx, cy]); if (tr.length > 28) tr.shift(); seen.add(o.id);
    return { id: o.id, cls: o.c === 'person' ? 'person' : o.c === 'car' || o.c === 'truck' ? 'car' : 'bag', x: cx, y: cy, box: [w, h], conf: o.p, trail: tr, staff: false, replay: o };
  });
  for (const id of rp.trails.keys()) if (!seen.has(id)) rp.trails.delete(id);
  cam.in = rp.crossings.filter(c => c.dir === 'in' && c.t <= t).length;
  cam.out = rp.crossings.filter(c => c.dir === 'out' && c.t <= t).length;
  const qz = cam.def.zones.find(z => z.kind === 'queue');
  cam.queue = qz ? cam.agents.filter(a => a.cls === 'person' && a.x >= qz.x && a.x <= qz.x + qz.w && a.y >= qz.y && a.y <= qz.y + qz.h).length : 0;
  for (const e of rp.events) if (!e._fired && e.t <= t && e.t > t - 2) { e._fired = true; raise(e.type, { cam, detail: e.detail, force: true }); }
  rp.lastT = t; cam.online = true; cam.fps = 25; return true;
}

setReplayHook(sync);
on('booted', start);
