import { get, rng } from '../store.js';
import { t, n, L, camName as cn } from '../i18n.js';
import { getCams } from '../engine.js';
import { drawTile } from '../render.js';
import { $, $$, clock, esc, toast } from '../ui.js';
import { audit } from '../audit.js';
import { icon } from '../icons.js';

const STAGES = () => [L('Ingest', 'استيعاب'), L('Detect', 'اكتشاف'), L('Track', 'تتبع'), L('Analyse', 'تحليل'), L('Report', 'تقرير')];

export function mount(root) {
  let cam = 0, playing = true, speed = 1, pos = new Date(get().now).getHours() * 60 + new Date(get().now).getMinutes(), raf, jobs = [], timer;
  const day0 = new Date(get().now); day0.setHours(0, 0, 0, 0);
  root.innerHTML = `<div class="page pb"><div class="page-head"><div><span class="label">${t('nav.analyse')}</span><h1>${L('Playback & post-processing', 'التشغيل والمعالجة اللاحقة')}</h1></div>
    <select id="pb-cam" class="sel" aria-label="${t('al.camera')}">${getCams().map((c, i) => `<option value="${i}">${c.def.id} · ${cn(c.def)}</option>`).join('')}</select></div>
    <div class="pb-grid"><section class="panel pb-player"><div class="clip big"><canvas width="960" height="540"></canvas><i class="tick tl"></i><i class="tick br"></i><span class="mono clip-l" id="pb-ts"></span></div>
      <div class="transport"><button class="btn sm" id="pb-play" aria-pressed="true">${icon('play')}<span>${L('Pause', 'إيقاف مؤقت')}</span></button>
        <div class="seg" role="group">${[.5, 1, 2, 4].map(s => `<button class="btn sm" data-sp="${s}" aria-pressed="${s === 1}">${s}×</button>`).join('')}</div>
        <span class="mono dim" id="pb-mode">${L('RECORDED · replay', 'مسجّل · إعادة')}</span></div>
      <div class="timeline" id="tl" role="slider" aria-label="Timeline" aria-valuemin="0" aria-valuemax="1439" tabindex="0"><div class="tl-track"></div><div class="tl-marks" id="tl-m"></div><div class="tl-head" id="tl-h"></div>
        <div class="tl-ax mono">${[0, 6, 12, 18, 24].map(h => `<span>${String(h).padStart(2, '0')}:00</span>`).join('')}</div></div></section>
    <section class="panel pb-jobs"><header><span class="label">${L('Upload footage for analysis', 'رفع مقاطع للتحليل')}</span></header>
      <label class="drop" for="pb-file"><span>${icon('upload')}${L('Drop a video here or browse', 'اسحب مقطعاً هنا أو تصفّح')}</span><input id="pb-file" type="file" accept="video/*" class="sr-only"></label>
      <ul id="jobs" class="jobs"></ul></section></div></div>`;

  const marks = () => {
    const r = rng(cam * 31 + 5), seeded = Array.from({ length: 9 }, () => ({ m: Math.floor(r() * 1400), sev: r() < .3 ? 'crit' : r() < .6 ? 'warn' : 'info' }));
    const live = get().alerts.filter(a => a.cam === getCams()[cam].def.id).map(a => ({ m: new Date(a.ts).getHours() * 60 + new Date(a.ts).getMinutes(), sev: a.sev }));
    $('#tl-m', root).innerHTML = [...seeded, ...live].map(k => `<i class="mk ${k.sev}" style="--p:${k.m / 1440}" data-m="${k.m}" title="${String(Math.floor(k.m / 60)).padStart(2, '0')}:${String(k.m % 60).padStart(2, '0')}"></i>`).join('');
  };
  const head = () => { $('#tl-h', root).style.setProperty('--p', pos / 1440); $('#tl', root).setAttribute('aria-valuenow', Math.round(pos)); $('#pb-ts', root).textContent = `${day0.toISOString().slice(0, 10)} ${String(Math.floor(pos / 60) % 24).padStart(2, '0')}:${String(Math.floor(pos % 60)).padStart(2, '0')} · ${getCams()[cam].def.id}`; };
  const seek = (e) => { const r = $('#tl', root).getBoundingClientRect(); let p = (e.clientX - r.left) / r.width; if (document.dir === 'rtl' || document.documentElement.dir === 'rtl') p = 1 - p; pos = Math.max(0, Math.min(1439, p * 1440)); head(); };
  let drag = false; const tl = $('#tl', root);
  tl.addEventListener('pointerdown', (e) => { drag = true; tl.setPointerCapture(e.pointerId); seek(e); });
  tl.addEventListener('pointermove', (e) => drag && seek(e)); tl.addEventListener('pointerup', () => drag = false);
  tl.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') pos = Math.min(1439, pos + 5); if (e.key === 'ArrowLeft') pos = Math.max(0, pos - 5); head(); });
  $('#pb-cam', root).addEventListener('change', (e) => { cam = +e.target.value; marks(); head(); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('#pb-play')) { playing = !playing; const b = $('#pb-play', root); b.setAttribute('aria-pressed', playing); $('span', b).textContent = playing ? L('Pause', 'إيقاف مؤقت') : L('Play', 'تشغيل'); }
    const s = e.target.closest('[data-sp]'); if (s) { speed = +s.dataset.sp; $$('[data-sp]', root).forEach(x => x.setAttribute('aria-pressed', x === s)); }
  });

  // ---- batch job simulation ----
  const stageNames = STAGES();
  const renderJobs = () => { $('#jobs', root).innerHTML = jobs.map(j => {
    const done = j.p >= 100, si = Math.min(4, Math.floor(j.p / 20));
    return `<li class="job ${done ? 'done' : ''}"><div class="row"><b>${esc(j.name)}</b><span class="mono dim">${done ? L('Done', 'اكتمل') : `${stageNames[si]} · ETA ${Math.max(1, Math.round((100 - j.p) / 8))}s`}</span></div>
      <div class="prog"><i style="--w:${j.p / 100}"></i></div>
      <div class="stages mono">${stageNames.map((s, i) => `<span class="${i < si || done ? 'ok' : i === si ? 'now' : ''}">${s}</span>`).join('')}</div>
      ${done ? `<button class="btn sm" data-rep="${j.id}">${L('Open report', 'فتح التقرير')}</button>` : ''}</li>`; }).join(''); };
  $('#pb-file', root).addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    jobs.unshift({ id: Date.now(), name: f.name, p: 0 }); audit('upload.footage', f.name); renderJobs(); toast(L('Job queued', 'تمت إضافة المهمة'));
  });
  jobs.push({ id: 1, name: 'entrance_2026-10-25.mp4', p: 100 });
  renderJobs();
  $('#jobs', root).addEventListener('click', (e) => { if (e.target.closest('[data-rep]')) location.hash = '#/reports'; });
  timer = setInterval(() => { let ch = false; jobs.forEach(j => { if (j.p < 100) { j.p = Math.min(100, j.p + 4 + Math.random() * 5); ch = true; } }); if (ch) renderJobs(); }, 700);

  let last = 0, prev = performance.now(), first = true;
  const loop = (ts) => {
    raf = requestAnimationFrame(loop);
    const dt = (ts - prev) / 1000; prev = ts;
    if (playing) { pos = (pos + dt * speed / 60) % 1440; if (ts - last > 250) head(); }
    if (ts - last < 40) return; last = ts;
    if (playing || first) { drawTile($('canvas', root), getCams()[cam]); first = false; }
  };
  raf = requestAnimationFrame(loop);
  marks(); head();
  return () => { cancelAnimationFrame(raf); clearInterval(timer); };
}
