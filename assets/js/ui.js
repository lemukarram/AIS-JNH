import { get } from './store.js';
import { n } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg) {
  const el = h(`<div class="toast">${esc(msg)}</div>`);
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = 0; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 220); }, 3200);
}
export function announce(msg) { $('#live').textContent = msg; }

export function clock(ts, secs = true) {
  const d = new Date(ts);
  if (get().lang === 'ar') return new Intl.DateTimeFormat('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit', ...(secs ? { second: '2-digit' } : {}), hour12: true }).format(d);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}${secs ? ':' + p(d.getSeconds()) : ''}`;
}

// Rolling number: tweens to new value, only touches the DOM when the value changes.
export function setNum(el, v, opts) {
  if (!el) return;
  const prev = el._v;
  if (prev === v) return;
  el._v = v;
  if (prev === undefined || matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = n(v, opts); return; }
  const start = performance.now(), from = prev;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  const tick = (now) => {
    const k = Math.min(1, (now - start) / 360), e = 1 - Math.pow(1 - k, 3);
    el.textContent = n(from + (v - from) * e, { maximumFractionDigits: opts?.maximumFractionDigits ?? 0, ...opts });
    if (k < 1) requestAnimationFrame(tick); else el.textContent = n(v, opts);
  };
  requestAnimationFrame(tick);
}

export function sparkline(values, { w = 120, h: ht = 28, color = 'var(--signal)' } = {}) {
  if (!values.length) return '';
  if (values.length === 1) values = [values[0], values[0]];
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [i / (values.length - 1) * w, ht - 2 - (v - min) / span * (ht - 4)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><rect x="${last[0] - 2}" y="${last[1] - 2}" width="4" height="4" fill="${color}"/></svg>`;
}

export function modal(contentHtml, onMount) {
  const back = h(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${contentHtml}</div></div>`);
  const close = () => { back.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc_);
  document.body.append(back);
  back.querySelector('input,button,select')?.focus();
  onMount?.(back, close);
  return close;
}

export const downloadCSV = (name, rows) => {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
};

// inView helper: pauses off-screen work
export const visible = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
export const getBrand = () => get().brand;
