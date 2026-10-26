// Canvas renderer: procedural camera scene + detection overlay. Same overlay code would draw baked tracks over <video>.
import { get } from './store.js';
import { simTime } from './engine.js';
import { zoneName, clsWord } from './i18n.js';
const FONT = '"JetBrains Mono","Plex Arabic",monospace';

const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let C = null;
export function refreshColors() {
  C = { signal: cssv('--signal'), warn: cssv('--warn'), crit: cssv('--crit'), info: cssv('--info'), ok: cssv('--ok') };
}

function furniture(ctx, kind, W, H) {
  ctx.lineWidth = 1;
  const rect = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x * W, y * H, w * W, h * H); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.strokeRect(x * W + .5, y * H + .5, w * W, h * H); };
  const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x * W, y * H, r * W, 0, 7); ctx.fillStyle = '#26323b'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke(); };
  switch (kind) {
    case 'door': rect(.1, .0, .8, .12, '#1a2229'); rect(.4, .42, .2, .02, '#2c3a45'); rect(.05, .85, .9, .15, '#151c22'); break;
    case 'queue': rect(.45, .2, .4, .12, '#2a3640'); rect(.5, .08, .12, .1, '#1d272f'); for (let i = 0; i < 4; i++) rect(.08 + i * .0, .45 + i * .1, .22, .02, '#222d36'); break;
    case 'seating': for (const [x, y] of [[.22, .5], [.7, .42], [.4, .22], [.2, .25], [.75, .7]]) { circ(x, y, .04); circ(x - .08, y, .015); circ(x + .08, y, .015); } break;
    case 'kitchen': rect(.45, .2, .4, .22, '#2b3842'); rect(.1, .6, .3, .25, '#243039'); rect(.55, .62, .3, .12, '#202b33'); break;
    case 'bar': rect(.12, .25, .76, .14, '#2b3842'); for (let i = 0; i < 7; i++) circ(.18 + i * .105, .5, .016); break;
    case 'corridor': rect(0, .2, 1, .02, '#2a3640'); rect(0, .78, 1, .02, '#2a3640'); for (let i = 1; i < 6; i++) rect(i * .17, .1, .01, .1, '#26323b'); rect(.62, .3, .3, .4, 'rgba(255,92,92,.06)'); break;
    case 'parking': for (let i = 0; i < 6; i++) rect(.12 + i * .13, .22, .01, .22, '#3a4651'); for (let i = 0; i < 6; i++) rect(.12 + i * .13, .6, .01, .22, '#3a4651'); break;
  }
}

function person(ctx, a, x, y, w, h, tint) {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + h * .5, w * .55, h * .1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = tint; ctx.beginPath();
  ctx.roundRect(x - w * .28, y - h * .3, w * .56, h * .75, w * .22); ctx.fill();
  ctx.fillStyle = '#9fb0bb'; ctx.beginPath(); ctx.arc(x, y - h * .4, w * .2, 0, 7); ctx.fill();
}

export function drawTile(canvas, cam, opts = {}) {
  if (!C) refreshColors();
  const ctx = canvas.getContext('2d'); const W0 = canvas.width, H0 = canvas.height; let W = W0, H = H0;
  const fl = get().flags, def = cam.def, t = simTime();
  const rp = cam.replay?.ready && cam.replay.video.readyState >= 2 ? cam.replay : null;
  if (rp) {
    // real footage, letterboxed; overlay coordinates are normalised to the video frame
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W0, H0);
    const vw = rp.video.videoWidth || 16, vh = rp.video.videoHeight || 9, k = Math.min(W0 / vw, H0 / vh), dw = vw * k, dh = vh * k, ox = (W0 - dw) / 2, oy = (H0 - dh) / 2;
    ctx.drawImage(rp.video, ox, oy, dw, dh); ctx.save(); ctx.translate(ox, oy); W = dw; H = dh;
  } else {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12181d'); g.addColorStop(1, '#0d1216');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += W / 16) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
  for (let y = 0; y <= H; y += H / 9) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
  ctx.stroke();
  furniture(ctx, def.scene, W, H);
  }
  if (!cam.online) { reconnect(ctx, W, H, t); return; }

  // zones
  if (fl.zones) for (const z of def.zones) {
    const col = z.kind === 'restricted' ? C.crit : z.kind === 'queue' ? C.warn : C.info;
    ctx.fillStyle = col + '14'; ctx.strokeStyle = col + 'aa'; ctx.setLineDash([5, 4]);
    ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H); ctx.strokeRect(z.x * W + .5, z.y * H + .5, z.w * W, z.h * H); ctx.setLineDash([]);
    if (opts.labels !== false) { const ar = get().lang === 'ar'; ctx.fillStyle = col; ctx.font = `500 ${ar ? 11 : 10}px ${FONT}`; ctx.direction = ar ? 'rtl' : 'ltr'; ctx.textAlign = 'left'; ctx.fillText(ar ? zoneName(z) : z.name.toUpperCase(), z.x * W + 5, z.y * H + 13); ctx.direction = 'ltr'; }
  }
  if (fl.zones && def.line) {
    ctx.strokeStyle = C.signal; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(def.line.a[0] * W, def.line.a[1] * H); ctx.lineTo(def.line.b[0] * W, def.line.b[1] * H); ctx.stroke(); ctx.lineWidth = 1;
    if (cam.flash > 0) { ctx.strokeStyle = '#fff'; ctx.globalAlpha = cam.flash; ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // heat
  if (fl.heat) for (const a of cam.agents) {
    const r = ctx.createRadialGradient(a.x * W, a.y * H, 0, a.x * W, a.y * H, W * .09);
    r.addColorStop(0, 'rgba(255,140,0,.35)'); r.addColorStop(1, 'rgba(255,140,0,0)'); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
  // people + overlay
  const sorted = [...cam.agents].sort((a, b) => a.y - b.y);
  for (const a of sorted) {
    const bw = a.box[0] * W, bh = a.box[1] * H, x = a.x * W, y = a.y * H;
    if (rp) {
      if (fl.blur && a.cls === 'person') { ctx.fillStyle = 'rgba(70,85,98,.92)'; ctx.fillRect(x - bw / 2, y - bh, bw, bh * .22); }
    } else if (a.cls === 'car') { ctx.fillStyle = '#34414c'; ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 3, bw, bh * .66, 6); ctx.fill(); }
    else if (a.cls === 'bag') { ctx.fillStyle = '#5a4a36'; ctx.fillRect(x - 6, y - 5, 12, 10); }
    else person(ctx, a, x, y, bw * .8, bh, a.staff ? '#3a5a6b' : `hsl(${200 + a.hue * 40},12%,${34 + a.hue * 14}%)`);
    if (fl.blur && a.cls === 'person') { ctx.fillStyle = 'rgba(90,110,125,.85)'; ctx.beginPath(); ctx.arc(x, y - bh * .4, bw * .26, 0, 7); ctx.fill(); }
    if (fl.skeleton && a.cls === 'person') skeleton(ctx, x, y, bw, bh);
    if (fl.trails && a.trail.length > 2) {
      ctx.strokeStyle = C.signal + '77'; ctx.lineWidth = 1.5; ctx.beginPath();
      a.trail.forEach(([tx, ty], i) => i ? ctx.lineTo(tx * W, ty * H) : ctx.moveTo(tx * W, ty * H)); ctx.stroke();
    }
    if (fl.boxes) {
      const bx = x - bw / 2, by = rp ? y - bh : y - bh * .55, hot = cam.lock && cam.lock.until > t && Math.hypot(a.x - cam.lock.at[0], a.y - cam.lock.at[1]) < .12;
      ctx.strokeStyle = hot ? C.crit : C.signal; ctx.lineWidth = hot ? 2 : 1;
      corners(ctx, bx, by, bw, bh);
      if (opts.labels !== false) {
        const ar = get().lang === 'ar', label = ar ? `${clsWord(a.cls, a.staff)} ⁦${Math.round(a.conf * 100)}%⁩ ⁦#${a.id}⁩` : `${a.cls === 'person' ? (a.staff ? 'staff' : 'person') : a.cls} #${a.id} ${Math.round(a.conf * 100)}%`;
        ctx.font = `500 ${ar ? 10 : 9}px ${FONT}`; ctx.direction = ar ? 'rtl' : 'ltr'; ctx.textAlign = 'left'; const tw = ctx.measureText(label).width + (ar ? 14 : 8);
        ctx.fillStyle = hot ? C.crit : C.signal; ctx.fillRect(bx, by - 13, tw, 13);
        ctx.fillStyle = '#10140A'; ctx.fillText(label, bx + 4, by - 3); ctx.direction = 'ltr';
      }
    }
  }
  // lock-on reticle for fresh alerts
  if (cam.lock && cam.lock.until > t) {
    const k = (cam.lock.until - t) / 3, r = 24 + (1 - k) * 40, lx = cam.lock.at[0] * W, ly = cam.lock.at[1] * H;
    ctx.strokeStyle = C.crit; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.lineWidth = 1.5;
    ctx.strokeRect(lx - r, ly - r, r * 2, r * 2); ctx.beginPath(); ctx.moveTo(lx - r - 8, ly); ctx.lineTo(lx - r + 8, ly); ctx.moveTo(lx + r - 8, ly); ctx.lineTo(lx + r + 8, ly); ctx.moveTo(lx, ly - r - 8); ctx.lineTo(lx, ly - r + 8); ctx.moveTo(lx, ly + r - 8); ctx.lineTo(lx, ly + r + 8); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  if (rp) {
    ctx.restore(); W = W0; H = H0;
    ctx.fillStyle = '#B4C0CB'; ctx.font = '500 9px "JetBrains Mono",monospace'; ctx.direction = get().lang === 'ar' ? 'rtl' : 'ltr'; ctx.fillText(get().lang === 'ar' ? 'لقطات تجريبية · اكتشافات محسوبة مسبقاً' : 'SAMPLE FOOTAGE · BAKED DETECTIONS', 10, H0 - 28); ctx.direction = 'ltr';
  }
  // low-light IR look + grain
  if (def.night) { ctx.fillStyle = 'rgba(30,255,120,.06)'; ctx.globalCompositeOperation = 'overlay'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
}

function corners(ctx, x, y, w, h) {
  const l = Math.min(8, w / 3); ctx.beginPath();
  ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y); ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h); ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l); ctx.stroke();
}
function skeleton(ctx, x, y, w, h) {
  ctx.strokeStyle = C.info; ctx.lineWidth = 1.5; ctx.beginPath();
  const hy = y - h * .4, sy = y - h * .22, hp = y + h * .1;
  ctx.moveTo(x, hy); ctx.lineTo(x, hp); ctx.moveTo(x - w * .25, sy); ctx.lineTo(x + w * .25, sy);
  ctx.moveTo(x, hp); ctx.lineTo(x - w * .15, y + h * .45); ctx.moveTo(x, hp); ctx.lineTo(x + w * .15, y + h * .45); ctx.stroke();
}
function reconnect(ctx, W, H, t) {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.warn; ctx.font = `500 13px ${FONT}`; ctx.textAlign = 'center'; const ar = get().lang === 'ar'; ctx.direction = ar ? 'rtl' : 'ltr';
  ctx.fillText((ar ? 'جارٍ إعادة الاتصال' : 'RECONNECTING') + '.'.repeat(1 + Math.floor(t * 2) % 3), W / 2, H / 2); ctx.direction = 'ltr'; ctx.textAlign = 'start';
}
