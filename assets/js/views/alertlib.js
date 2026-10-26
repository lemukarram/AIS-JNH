import { t, L, ltr } from '../i18n.js';
import { clock, esc, toast } from '../ui.js';
import { setAlertStatus } from '../engine.js';
import { can } from '../auth.js';
import { icon } from '../icons.js';

export const title = (a) => t('a.' + a.type);
export function sevTag(s) { return `<span class="sev ${s}">${t('sev.' + s)}</span>`; }

export function row(a, { actions = true } = {}) {
  const cant = !can('ack');
  return `<li class="arow" data-id="${a.id}" data-status="${a.status}" data-sev="${a.sev}">
    <canvas class="snap" width="96" height="54" data-snap="${a.id}" aria-hidden="true"></canvas>
    <div class="abody">
      <div class="ahead">${sevTag(a.sev)}<span class="mono dim">${clock(a.ts)}</span></div>
      <strong>${esc(title(a))}</strong>
      <span class="dim mono" dir="ltr">${a.cam} · ${a.conf}%</span>${a.detail?.len ? `<span class="dim small">${L('Count', 'العدد')}: ${a.detail.len}</span>` : ''}
      ${actions ? `<div class="aact">
        <button class="btn sm" data-act="ack" ${cant || a.status !== 'new' ? 'disabled' : ''}>${icon('check')}${t('al.ack')}</button>
        <button class="btn sm" data-act="esc" ${cant ? 'disabled' : ''}>${icon('flag')}${t('al.escalate')}</button>
        <button class="btn sm ghost" data-act="bm" aria-label="${t('al.bookmark')}">${icon('bookmark')}</button>
      </div>` : ''}
    </div></li>`;
}

export function wire(list) {
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const id = +b.closest('.arow').dataset.id;
    if (b.dataset.act === 'ack') { setAlertStatus(id, 'acknowledged'); toast(t('al.acked')); }
    if (b.dataset.act === 'esc') toast(t('al.escalated'));
    if (b.dataset.act === 'bm') { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }
  });
}
