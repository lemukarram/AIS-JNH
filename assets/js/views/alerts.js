import { get, on } from '../store.js';
import { t, n, L, camName as cn } from '../i18n.js';
import { setAlertStatus, getCams } from '../engine.js';
import { drawTile } from '../render.js';
import { $, $$, clock, esc, toast, downloadCSV } from '../ui.js';
import { can } from '../auth.js';
import { icon } from '../icons.js';
import * as AL from './alertlib.js';

export function mount(root) {
  let filter = 'all', sel = null, raf;
  root.innerHTML = `
  <div class="page">
    <div class="page-head"><div><span class="label">${t('nav.operate')}</span><h1>${t('al.title')}</h1></div>
      <div class="seg" role="group">${['all', 'new', 'acknowledged', 'resolved'].map(f => `<button class="btn sm" data-f="${f}" aria-pressed="${f === 'all'}">${t(f === 'all' ? 'al.all' : 'al.' + f)}</button>`).join('')}
      <button class="btn sm" id="csv">${icon('report')}CSV</button></div></div>
    <div class="al-grid">
      <div class="panel tbl-wrap"><table class="tbl"><thead><tr><th>${t('al.sev')}</th><th>${t('al.type')}</th><th class="hide-m">${t('al.camera')}</th><th>${t('al.time')}</th><th>${t('al.status')}</th></tr></thead><tbody id="tb"></tbody></table></div>
      <aside class="panel detail" id="detail"></aside>
    </div>
  </div>`;
  const rows = () => get().alerts.filter(a => filter === 'all' || a.status === filter);
  const renderTbl = () => {
    const r = rows();
    $('#tb', root).innerHTML = r.length ? r.map(a => `<tr data-id="${a.id}" tabindex="0" class="${sel === a.id ? 'sel' : ''}" data-sev="${a.sev}"><td>${AL.sevTag(a.sev)}</td><td>${esc(AL.title(a))}</td><td class="mono hide-m">${a.cam}</td><td class="mono">${clock(a.ts)}</td><td><span class="st ${a.status}">${t('al.' + a.status)}</span></td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">${t('al.empty')}</td></tr>`;
    if (!sel && r[0]) sel = r[0].id;
    renderDetail();
  };
  const renderDetail = () => {
    const a = get().alerts.find(x => x.id === sel), d = $('#detail', root);
    if (!a) { d.innerHTML = `<div class="empty">${t('wall.empty')}</div>`; return; }
    const cant = !can('ack');
    d.innerHTML = `<header><span class="label">#${String(a.id).padStart(4, '0')}</span>${AL.sevTag(a.sev)}</header>
      <div class="clip"><canvas width="480" height="270"></canvas><i class="tick tl"></i><i class="tick br"></i><span class="mono clip-l">${t('al.clip')}</span></div>
      <div class="dbody"><h2>${esc(AL.title(a))}</h2>
        <dl class="mono"><dt>${t('al.camera')}</dt><dd><span dir="ltr">${a.cam}</span> · ${cn(getCams().find(c => c.def.id === a.cam).def)}</dd><dt>${t('al.time')}</dt><dd>${clock(a.ts)}</dd><dt>${t('al.conf')}</dt><dd>${a.conf}%</dd><dt>${t('al.rule')}</dt><dd>${esc(AL.title(a))} · v1</dd></dl>
        <div class="aact"><button class="btn sm primary" data-a="ack" ${cant || a.status !== 'new' ? 'disabled' : ''}>${t('al.ack')}</button>
          <button class="btn sm" data-a="res" ${cant || a.status === 'resolved' ? 'disabled' : ''}>${t('al.resolve')}</button>
          <button class="btn sm" data-a="esc" ${cant ? 'disabled' : ''}>${t('al.escalate')}</button></div></div>`;
  };
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; $$('[data-f]', root).forEach(b => b.setAttribute('aria-pressed', b === f)); renderTbl(); }
    const tr = e.target.closest('tr[data-id]'); if (tr) { sel = +tr.dataset.id; renderTbl(); }
    const b = e.target.closest('[data-a]'); if (b && !b.disabled) {
      if (b.dataset.a === 'ack') { setAlertStatus(sel, 'acknowledged'); toast(t('al.acked')); }
      if (b.dataset.a === 'res') { setAlertStatus(sel, 'resolved'); toast(t('al.resolvedT')); }
      if (b.dataset.a === 'esc') toast(t('al.escalated'));
    }
    if (e.target.closest('#csv')) downloadCSV('alerts.csv', [[L('ID', 'الرقم'), t('al.type'), t('al.sev'), t('al.camera'), t('al.time'), t('al.status'), t('al.conf')], ...get().alerts.map(a => [a.id, t('a.' + a.type), t('sev.' + a.sev), a.cam, new Date(a.ts).toISOString(), t('al.' + a.status), a.conf + '%'])]);
  });
  // looping "clip": replays the camera at the event position
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const cv = $('.clip canvas', root), a = get().alerts.find(x => x.id === sel); if (!cv || !a) return;
    const cam = getCams().find(c => c.def.id === a.cam); if (cam) { cam.lock = cam.lock?.until > 0 && cam.lock.at === a.at ? cam.lock : { until: Infinity, at: a.at }; drawTile(cv, cam); }
  };
  raf = requestAnimationFrame(loop);
  const off = on('alerts', renderTbl);
  renderTbl();
  return () => { cancelAnimationFrame(raf); off(); getCams().forEach(c => { if (c.lock?.until === Infinity) c.lock = null; }); };
}
