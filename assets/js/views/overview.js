import { get, on } from '../store.js';
import { t, n, applyDom } from '../i18n.js';
import { getPreset, hourlyFor, hourCurve } from '../engine.js';
import { $, $$, setNum, sparkline, clock, esc } from '../ui.js';
import * as AL from './alertlib.js';

const KPI_FMT = { wait: { maximumFractionDigits: 1 } };

export function mount(root) {
  const P = getPreset(), s = get();
  const kp = P.kpis.filter(k => k !== 'inside' && k !== 'occupancy');
  const hist = {}; // rolling sparkline series per kpi
  root.innerHTML = `
  <div class="page ov">
    <div class="page-head"><div><span class="label">${esc(P.venue)}</span><h1>${t('ov.title')}</h1></div>
      <span class="pill mono" id="ov-model">${t('ov.model')} · YOLOv8n · <b id="ov-fps">—</b> ${t('fps')} · <b id="ov-lat">—</b> ms</span></div>
    <div class="ov-grid">
      <section class="panel hero-kpi">
        <i class="tick tl"></i><i class="tick br"></i>
        <span class="label">${t('kpi.inside')}</span>
        <div class="big num"><span id="k-inside">0</span><small>/ ${n(P.capacity)}</small></div>
        <div class="gauge" role="img" aria-label="${t('kpi.occupancy')}"><div class="gauge-fill" id="gauge"></div><div class="gauge-ticks"></div></div>
        <div class="hero-foot"><span><b class="num" id="k-occ">0</b>% ${t('kpi.occupancy')}</span><span id="k-vs" class="mono dim"></span></div>
      </section>
      <section class="kpi-strip">${kp.map(k => `
        <div class="kpi" data-k="${k}"><span class="label">${t('kpi.' + k)}</span><b class="num" data-v>0</b><span class="spark" data-s></span><span class="delta mono" data-d></span></div>`).join('')}
      </section>
      <section class="panel chart-panel"><header><span class="label">${t('ov.hourly')}</span><span class="legend mono"><i class="sw s1"></i>${t('ov.today')} <i class="sw s2"></i>${t('ov.avg')}</span></header>
        <div class="chart" id="hourly"></div></section>
      <section class="panel floor"><header><span class="label">${t('ov.floor')}</span></header><div class="floor-body"><canvas id="floor" width="560" height="300"></canvas></div></section>
      <section class="panel zones"><header><span class="label">${t('ov.zones')}</span></header><ol id="zlist"></ol></section>
      <section class="panel ticker"><header><span class="label">${t('ov.ticker')}</span><span class="led"></span></header><ul class="alist compact" id="tk"></ul></section>
    </div>
  </div>`;
  AL.wire($('#tk', root));

  // ---- hourly chart (hand-built SVG, hover crosshair) ----
  const W = 720, H = 220, pad = { l: 36, r: 8, t: 10, b: 22 };
  const today = s.hourly, avg = hourlyFor(new Date(Date.now() - 7 * 864e5));
  const max = Math.max(...today, ...avg) * 1.1;
  const x = (i) => pad.l + i / 23 * (W - pad.l - pad.r), y = (v) => H - pad.b - v / max * (H - pad.t - pad.b);
  const nowH = new Date(s.now).getHours();
  const line = (arr, to = 23) => arr.slice(0, to + 1).map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
  const grid = [0, .25, .5, .75, 1].map(f => { const v = max * f / 1.1 * 1; return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${pad.l - 6}" y="${y(max * f) + 3}" class="ax" text-anchor="end">${Math.round(max * f)}</text>`; }).join('');
  const xt = [0, 4, 8, 12, 16, 20, 23].map(i => `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${String(i).padStart(2, '0')}</text>`).join('');
  $('#hourly', root).innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t('ov.hourly')}">${grid}${xt}
    <path d="${line(avg)}" class="ln2"/>
    <path d="${line(today, nowH)} L${x(nowH)} ${y(0)} L${x(0)} ${y(0)}Z" class="area"/>
    <path d="${line(today, nowH)}" class="ln1"/>
    <line id="hx" y1="${pad.t}" y2="${H - pad.b}" class="hx" hidden/><circle id="hd" r="4" class="hd" hidden/>
    <rect id="hover" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/></svg><div class="tip mono" id="tip" hidden></div>`;
  const hov = $('#hover', root), tip = $('#tip', root), hx = $('#hx', root), hd = $('#hd', root);
  hov.addEventListener('pointermove', (e) => {
    const r = hov.getBoundingClientRect(), i = Math.max(0, Math.min(23, Math.round((e.clientX - r.left) / r.width * 23)));
    hx.setAttribute('x1', x(i)); hx.setAttribute('x2', x(i)); hd.setAttribute('cx', x(i)); hd.setAttribute('cy', y(today[i]));
    hx.hidden = hd.hidden = tip.hidden = false;
    tip.innerHTML = `${String(i).padStart(2, '0')}:00<br><b>${n(today[i])}</b> ${t('ov.today')}<br>${n(avg[i])} ${t('ov.avg')}`;
    tip.style.insetInlineStart = (x(i) / W * 100) + '%';
  });
  hov.addEventListener('pointerleave', () => { hx.hidden = hd.hidden = tip.hidden = true; });

  // ---- live updates ----
  const fctx = $('#floor', root).getContext('2d');
  let ticks = 0;
  const update = () => {
    const k = get().kpi; if (!k) return;
    setNum($('#k-inside', root), k.inside); setNum($('#k-occ', root), k.occupancy);
    $('#gauge', root).style.setProperty('--v', k.occupancy / 100);
    $('#gauge', root).parentElement.classList.toggle('hot', k.occupancy > 85);
    const dy = k.footfall - Math.round(k.yesterday * Math.min(1, (get().now % 864e5) / 864e5 + .4));
    $('#k-vs', root).innerHTML = `${t('kpi.vsYesterday')} <bdi dir="ltr">${dy >= 0 ? '+' : '−'}${n(Math.abs(Math.round(dy / Math.max(1, k.footfall) * 100)))}%</bdi>`;
    $('#ov-fps', root).textContent = k.fps; $('#ov-lat', root).textContent = k.latency;
    $$('.kpi', root).forEach(el => {
      const key = el.dataset.k; let v = key === 'cams' ? k.cams : k[key];
      setNum($('[data-v]', el), v, KPI_FMT[key]);
      if (key === 'cams') $('[data-v]', el).dataset.of = `/ ${k.camsTotal}`;
      if (ticks % 10 === 0) { (hist[key] ||= []).push(v); if (hist[key].length > 24) hist[key].shift(); $('[data-s]', el).innerHTML = sparkline(hist[key], { w: 96, h: 22 }); }
    });
    ticks++;
    if (ticks % 5 === 0) { drawFloor(); zones(); }
  };
  const zones = () => {
    const rows = get().cams.flatMap(c => c.def.zones.map(z => ({ name: z.name, cam: c.def.id, cnt: c.agents.filter(a => a.cls === 'person' && a.x > z.x && a.x < z.x + z.w && a.y > z.y && a.y < z.y + z.h).length, kind: z.kind })))
      .sort((a, b) => b.cnt - a.cnt).slice(0, 6); const mx = Math.max(1, rows[0]?.cnt || 1);
    $('#zlist', root).innerHTML = rows.map(r => `<li><span>${esc(r.name)}<small class="mono dim">${r.cam}</small></span><i class="bar" style="--w:${r.cnt / mx}"></i><b class="num">${n(r.cnt)}</b></li>`).join('');
  };
  const drawFloor = () => {
    const c = $('#floor', root), W2 = c.width, H2 = c.height, cams = get().cams; fctx.clearRect(0, 0, W2, H2);
    const cs = getComputedStyle(document.documentElement), line_ = cs.getPropertyValue('--line-strong'), sig = cs.getPropertyValue('--signal'), crit = cs.getPropertyValue('--crit');
    fctx.strokeStyle = line_; fctx.lineWidth = 1.5;
    const cw = W2 / 3, chh = H2 / 2;
    cams.forEach((cam, i) => {
      const ox = (i % 3) * cw + 10, oy = Math.floor(i / 3) * chh + 10, w = cw - 20, h = chh - 20;
      fctx.strokeRect(ox, oy, w, h); fctx.fillStyle = cs.getPropertyValue('--fg-2'); fctx.font = '500 10px "JetBrains Mono",monospace'; fctx.fillText(cam.def.id, ox + 6, oy + 14);
      for (const a of cam.agents) {
        const g = fctx.createRadialGradient(ox + a.x * w, oy + a.y * h, 0, ox + a.x * w, oy + a.y * h, 22);
        g.addColorStop(0, sig + 'aa'); g.addColorStop(1, sig + '00'); fctx.fillStyle = g; fctx.fillRect(ox, oy, w, h);
      }
      fctx.save(); fctx.beginPath(); fctx.rect(ox, oy, w, h); fctx.clip();
      for (const a of cam.agents) { fctx.fillStyle = sig; fctx.fillRect(ox + a.x * w - 1.5, oy + a.y * h - 1.5, 3, 3); }
      fctx.restore();
      if (cam.lock && cam.lock.until > 0 && cam.flash > .2) { fctx.strokeStyle = crit; fctx.strokeRect(ox - 3, oy - 3, w + 6, h + 6); fctx.strokeStyle = line_; }
    });
  };
  const tickerRender = () => {
    const al = get().alerts.slice(0, 7);
    $('#tk', root).innerHTML = al.length ? al.map(a => AL.row(a, { actions: false })).join('') : `<li class="empty">${t('wall.empty')}</li>`;
    $$('canvas.snap', root).forEach(cv => cv.remove());
  };
  const offs = [on('tick', update), on('alerts', tickerRender), on('lang', () => applyDom(root))];
  update(); drawFloor(); zones(); tickerRender();
  return () => offs.forEach(f => f());
}
