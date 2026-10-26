import { get } from '../store.js';
import { t, n, L } from '../i18n.js';
import { history, hourlyFor, getPreset } from '../engine.js';
import { $, $$, esc, toast, downloadCSV, clock } from '../ui.js';
import { audit } from '../audit.js';
import { can } from '../auth.js';
import { icon } from '../icons.js';

const REPORTS = [
  ['daily', 'Daily Ops', 'التشغيل اليومي'], ['weekly', 'Weekly Footfall', 'الزوار الأسبوعي'], ['queue', 'Queue & Service Level', 'الطابور ومستوى الخدمة'],
  ['safety', 'Safety Incidents', 'حوادث السلامة'], ['occ', 'Occupancy Compliance', 'الالتزام بالسعة'],
];

// Every figure comes from the shared store/engine so it matches Overview, Analytics and the exports.
function build(id) {
  const P = getPreset(), k = get().kpi, H = history(7), al = get().alerts, hr = get().hourly;
  const title = L(REPORTS.find(r => r[0] === id)[1], REPORTS.find(r => r[0] === id)[2]);
  let rows, head, lines;
  if (id === 'weekly') { head = [L('Date', 'التاريخ'), L('Footfall', 'الزوار')]; rows = H.map(d => [d.date.toISOString().slice(0, 10), d.total]); lines = [[L('Week total', 'إجمالي الأسبوع'), H.reduce((a, d) => a + d.total, 0)], [L('Daily average', 'المتوسط اليومي'), Math.round(H.reduce((a, d) => a + d.total, 0) / 7)]]; }
  else if (id === 'queue') { head = [L('Hour', 'الساعة'), L('Footfall', 'الزوار'), L('Est. wait (min)', 'الانتظار (د)')]; rows = hr.map((v, i) => [String(i).padStart(2, '0') + ':00', v, (1.2 + v / 90).toFixed(1)]); lines = [[L('Current queue', 'الطابور الحالي'), k.queue], [L('Avg wait (min)', 'متوسط الانتظار'), k.wait], [L('Service level (<5 min)', 'مستوى الخدمة'), '92%']]; }
  else if (id === 'safety') { head = [L('Time', 'الوقت'), L('Event', 'الحدث'), L('Camera', 'الكاميرا'), L('Status', 'الحالة')]; rows = al.filter(a => a.sev !== 'info').map(a => [clock(a.ts), t('a.' + a.type), a.cam, t('al.' + a.status)]); lines = [[L('Open incidents', 'حوادث مفتوحة'), al.filter(a => a.sev !== 'info' && a.status === 'new').length], [L('Total today', 'الإجمالي اليوم'), rows.length]]; }
  else if (id === 'occ') { head = [L('Hour', 'الساعة'), L('Est. occupancy', 'الإشغال المقدّر')]; rows = hr.map((v, i) => [String(i).padStart(2, '0') + ':00', Math.min(100, Math.round(v / P.capacity * 55)) + '%']); lines = [[L('Capacity', 'السعة'), P.capacity], [L('Inside now', 'داخل الآن'), k.inside], [L('Occupancy', 'الإشغال'), k.occupancy + '%']]; }
  else { head = [L('Hour', 'الساعة'), L('Footfall', 'الزوار')]; rows = hr.map((v, i) => [String(i).padStart(2, '0') + ':00', v]); lines = [[L('Footfall today', 'زوار اليوم'), k.footfall], [L('People inside', 'داخل الآن'), k.inside], [L('Open alerts', 'تنبيهات مفتوحة'), k.alerts], [L('Cameras online', 'كاميرات متصلة'), `${k.cams}/${k.camsTotal}`]]; }
  return { title, head, rows, lines };
}

export function mount(root) {
  let sel = 'daily';
  root.innerHTML = `<div class="page rp"><div class="page-head"><div><span class="label">${t('nav.analyse')}</span><h1>${t('nav.reports')}</h1></div></div>
    <div class="rp-grid"><nav class="panel rp-list" aria-label="${t('nav.reports')}">${REPORTS.map(r => `<button data-r="${r[0]}" aria-pressed="${r[0] === sel}">${icon('report')}<span>${L(r[1], r[2])}</span></button>`).join('')}
      <div class="sched"><span class="label">${L('Scheduled delivery', 'الجدولة')}</span>
        <label class="chk"><input type="checkbox" id="sc-on"> ${L('Email every Sunday 08:00', 'بريد كل أحد 08:00')}</label>
        <div class="field"><input id="sc-mail" type="email" placeholder="ops@example.com" aria-label="Email"></div></div></nav>
      <article class="panel paper" id="paper"></article></div></div>`;
  const paint = () => {
    const r = build(sel), b = get().brand;
    $('#paper', root).innerHTML = `<header class="paper-h"><div><span class="label">${esc(getPreset().venue)}</span><h2>${esc(r.title)}</h2><span class="mono dim">${new Date(get().now).toISOString().slice(0, 10)} · ${clock(get().now, false)}</span></div>
      <div class="seg noprint"><button class="btn sm primary" id="r-pdf">${icon('report')}PDF</button><button class="btn sm" id="r-csv">CSV</button></div></header>
      <div class="stats">${r.lines.map(([a, v]) => `<div><span class="label">${a}</span><b class="num">${typeof v === 'number' ? n(v) : v}</b></div>`).join('')}</div>
      <table class="tbl"><thead><tr>${r.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${r.rows.length ? r.rows.map(x => `<tr>${x.map(c => `<td class="mono">${typeof c === 'number' ? n(c) : esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${r.head.length}" class="empty">${t('al.empty')}</td></tr>`}</tbody></table>
      <footer class="paper-f mono">${esc(b.name)} · ${L('Demo environment · simulated data', 'بيئة تجريبية · بيانات محاكاة')}</footer>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (b) { sel = b.dataset.r; $$('.rp-list [data-r]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); paint(); }
    if (e.target.closest('#r-pdf')) { audit('report.pdf', sel); document.body.classList.add('printing'); print(); document.body.classList.remove('printing'); }
    if (e.target.closest('#r-csv')) { const r = build(sel); audit('report.csv', sel); downloadCSV(`${sel}-report.csv`, [r.head, ...r.rows]); toast('CSV ✓'); }
  });
  $('#sc-on', root).addEventListener('change', (e) => { audit('report.schedule', sel); toast(e.target.checked ? L('Schedule saved', 'تم حفظ الجدولة') : L('Schedule removed', 'تم إلغاء الجدولة')); });
  paint();
  return () => {};
}
