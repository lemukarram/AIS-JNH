import { get } from '../store.js';
import { t, n, L, fmtDate, days as dayWord } from '../i18n.js';
import { history, hourlyFor, hourCurve, getPreset } from '../engine.js';
import { $, $$, downloadCSV, toast } from '../ui.js';
import { icon } from '../icons.js';
import { rng } from '../store.js';

export function mount(root) {
  const P = getPreset();
  let range = 30;
  const FUNNEL = { en: { passers: 'Passers-by', entered: 'Entered', queued: 'Queued', seated: 'Seated', paid: 'Paid', arrived: 'Arrived', registered: 'Registered', triage: 'Triage', seen: 'Seen', discharged: 'Discharged', ordered: 'Ordered' },
    ar: { passers: 'المارّة', entered: 'دخلوا', queued: 'انتظروا', seated: 'جلسوا', paid: 'دفعوا', arrived: 'وصلوا', registered: 'سُجّلوا', triage: 'الفرز', seen: 'عُوينوا', discharged: 'خرجوا', ordered: 'طلبوا' } };
  root.innerHTML = `<div class="page an">
    <div class="page-head"><div><span class="label">${t('nav.analyse')}</span><h1>${t('nav.analytics')}</h1></div>
      <div class="seg" role="group">${[7, 30, 90].map(d => `<button class="btn sm" data-r="${d}" aria-pressed="${d === range}">${dayWord(d)}</button>`).join('')}
      <button class="btn sm" id="an-csv">${icon('report')}CSV</button></div></div>
    <p class="privacy mono">${L('PRIVACY-FIRST · counts and behaviour only · no face or identity data', 'الخصوصية أولاً · عدّ وسلوك فقط · دون بيانات وجه أو هوية')}</p>
    <div class="an-grid">
      <section class="panel a-days"><header><span class="label">${L('Daily footfall', 'الزوار يومياً')}</span><span class="mono dim" id="an-sum"></span></header><div class="chart" id="c-days"></div></section>
      <section class="panel a-heat"><header><span class="label">${L('Busy hours · weekday × hour', 'ساعات الذروة · اليوم × الساعة')}</span></header><div class="chart" id="c-heat"></div></section>
      <section class="panel a-fun"><header><span class="label">${L('Conversion funnel', 'قمع التحويل')}</span></header><div id="c-fun" class="funnel"></div></section>
      <section class="panel a-fc"><header><span class="label">${L('Peak-hour forecast (simulated)', 'توقع ساعات الذروة (محاكى)')}</span></header><div class="chart" id="c-fc"></div></section>
    </div></div>`;

  const draw = () => {
    const H = history(range), tot = H.reduce((a, d) => a + d.total, 0), mx = Math.max(...H.map(d => d.total)) * 1.1;
    $('#an-sum', root).textContent = `${n(tot)} ${L('total', 'الإجمالي')} · ${n(Math.round(tot / H.length))} ${L('avg/day', 'المتوسط اليومي')}`;
    const W = Math.max(300, ($('#c-days', root).clientWidth || 760) - 24), Ht = 220, pl = 40, pr = 8, pt = 10, pb = 22, bw = (W - pl - pr) / H.length;
    const y = (v) => Ht - pb - v / mx * (Ht - pt - pb);
    const bars = H.map((d, i) => `<rect x="${pl + i * bw + 1}" y="${y(d.total)}" width="${Math.max(1, bw - 2)}" height="${Ht - pb - y(d.total)}" class="${d.date.getDay() === 5 || d.date.getDay() === 6 ? 'bar-w' : 'bar-d'}" data-i="${i}"/>`).join('');
    const grid = [0, .5, 1].map(f => `<line x1="${pl}" x2="${W - pr}" y1="${y(mx * f)}" y2="${y(mx * f)}" class="gl"/><text x="${pl - 6}" y="${y(mx * f) + 3}" class="ax" text-anchor="end">${Math.round(mx * f / 1.1)}</text>`).join('');
    $('#c-days', root).innerHTML = `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}">${grid}${bars}<text x="${pl}" y="${Ht - 6}" class="ax">${fmtDate(H[0].date)}</text><text x="${W - pr}" y="${Ht - 6}" class="ax" text-anchor="end">${fmtDate(H[H.length - 1].date)}</text></svg><div class="tip mono" id="dtip" hidden></div>`;
    const tip = $('#dtip', root);
    $$('rect[data-i]', root).forEach(r => {
      r.addEventListener('pointerenter', () => { const d = H[+r.dataset.i]; tip.hidden = false; tip.innerHTML = `${fmtDate(d.date, { weekday: 'short', day: '2-digit', month: 'short' })}<br><b>${n(d.total)}</b>`; tip.style.insetInlineStart = ((+r.dataset.i + .5) / H.length * 92 + 5) + '%'; });
      r.addEventListener('pointerleave', () => tip.hidden = true);
    });
    // heatmap weekday x hour (from the same curve, so it agrees with the dashboard)
    const days = L(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']);
    const order = [6, 0, 1, 2, 3, 4, 5].map(i => i === 6 ? 6 : i);
    const hm = [0, 1, 2, 3, 4, 5, 6].map(d => Array.from({ length: 18 }, (_, k) => hourCurve(k + 6, d) * ([.85, .8, .8, .85, .95, 1.25, 1.15][d])));
    const hmax = Math.max(...hm.flat());
    $('#c-heat', root).innerHTML = `<div class="hm">${hm.map((r, d) => `<span class="hl mono">${days[d]}</span>${r.map((v, k) => `<i style="--v:${(v / hmax).toFixed(2)}" title="${days[d]} ${String(k + 6).padStart(2, '0')}:00 · ${Math.round(v / hmax * 100)}%"></i>`).join('')}`).join('')}</div>
      <div class="hm-axis mono"><span>06</span><span>12</span><span>18</span><span>23</span></div>`;
    // funnel
    const r = rng(7), ent = tot, steps = P.funnel, base = [ent * 3.4, ent, ent * .46, ent * .78, ent * .72];
    $('#c-fun', root).innerHTML = steps.map((s, i) => { const v = Math.round(base[i] || ent * .6), pct = v / base[0]; return `<div class="fstep"><span>${FUNNEL[get().lang][s] || s}</span><i style="--w:${pct}"></i><b class="num">${n(v)}</b><em class="mono dim">${i ? Math.round(v / Math.round(base[i - 1] || v) * 100) + '%' : ''}</em></div>`; }).join('');
    // forecast
    const today = hourlyFor(new Date()), nowH = new Date(get().now).getHours();
    const fc = today.map((v, i) => Math.round(v * (1 + Math.sin(i) * .04)));
    const mxf = Math.max(...fc) * 1.1, Wf = Math.max(260, ($('#c-fc', root).clientWidth || 520) - 24), Hf = 160, x = (i) => 24 + i / 23 * (Wf - 30), yf = (v) => Hf - 18 - v / mxf * (Hf - 28);
    const d = fc.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yf(v).toFixed(1)).join('');
    const pk = fc.indexOf(Math.max(...fc));
    $('#c-fc', root).innerHTML = `<svg viewBox="0 0 ${Wf} ${Hf}" width="${Wf}" height="${Hf}"><line x1="${x(nowH)}" x2="${x(nowH)}" y1="6" y2="${Hf - 18}" class="hx"/><path d="${d}" class="ln2" style="stroke:var(--signal)"/><circle cx="${x(pk)}" cy="${yf(fc[pk])}" r="4" class="hd"/>${[0, 6, 12, 18, 23].map(i => `<text x="${x(i)}" y="${Hf - 4}" class="ax" text-anchor="middle">${String(i).padStart(2, '0')}</text>`).join('')}</svg>
      <p class="mono dim small">${L('Predicted peak', 'الذروة المتوقعة')}: <b>${String(pk).padStart(2, '0')}:00</b> · ${L('suggested staffing', 'التوظيف المقترح')}: <b>${Math.max(2, Math.round(fc[pk] / 38))}</b></p>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (b) { range = +b.dataset.r; $$('[data-r]', root).forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }
    if (e.target.closest('#an-csv')) { downloadCSV('footfall.csv', [[L('Date', 'التاريخ'), L('Footfall', 'عدد الزوار')], ...history(range).map(d => [d.date.toISOString().slice(0, 10), d.total])]); toast('CSV ✓'); }
  });
  draw();
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 150); };
  addEventListener('resize', onResize);
  return () => removeEventListener('resize', onResize);
}
