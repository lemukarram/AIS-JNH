import { get, on } from '../store.js';
import { t, n, L, camName as cn, zoneName } from '../i18n.js';
import { getCams, addZone, setLine, addCamera } from '../engine.js';
import { drawTile } from '../render.js';
import { $, $$, esc, toast, modal } from '../ui.js';
import { audit } from '../audit.js';
import { can } from '../auth.js';
import { icon } from '../icons.js';

export function mount(root) {
  let sel = 0, tool = 'rect', kind = 'zone', draft = null, raf;
  const editable = can('cameras');
  root.innerHTML = `<div class="page cm"><div class="page-head"><div><span class="label">${t('nav.system')}</span><h1>${t('nav.cameras')}</h1></div>
    ${editable ? `<button class="btn primary" id="cm-add">${icon('cam')}${L('Add camera', 'إضافة كاميرا')}</button>` : ''}</div>
    <div class="cm-grid"><section class="panel"><table class="tbl" id="cm-t"></table></section>
    <section class="panel cm-ed"><header><span class="label">${L('Zone & line editor', 'محرّر المناطق والخطوط')}</span><span class="mono dim" id="ed-cam"></span></header>
      <div class="ed-canvas"><canvas width="960" height="540" id="ed"></canvas></div>
      <div class="ed-tools">${editable ? `<div class="seg" role="group"><button class="btn sm" data-tool="rect" aria-pressed="true">${L('Zone', 'منطقة')}</button><button class="btn sm" data-tool="line" aria-pressed="false">${L('Tripwire line', 'خط عدّ')}</button></div>
        <select id="ed-kind" class="sel" aria-label="${L('Zone type', 'نوع المنطقة')}"><option value="zone">${L('Standard', 'عادية')}</option><option value="queue">${L('Queue', 'طابور')}</option><option value="restricted">${L('Restricted', 'محظورة')}</option></select>
        <input id="ed-name" class="sel" placeholder="${L('Name', 'الاسم')}" aria-label="${L('Name', 'الاسم')}"><span class="dim small">${L('Drag on the frame to draw. It applies to the Live Wall immediately.', 'اسحب على الإطار للرسم. يظهر الأثر فوراً على الجدار المباشر.')}</span>` : `<span class="dim small">${L('Your role can view but not edit.', 'صلاحيتك للعرض فقط.')}</span>`}</div>
      <ul class="zlist" id="zl"></ul></section></div></div>`;

  const list = () => {
    $('#cm-t', root).innerHTML = `<thead><tr><th>${t('al.camera')}</th><th class="hide-m">${L('Stream', 'البث')}</th><th class="hide-m">${L('Health', 'الحالة')}</th><th>${L('Live', 'مباشر')}</th></tr></thead><tbody>${getCams().map((c, i) => `
      <tr data-i="${i}" tabindex="0" class="${i === sel ? 'sel' : ''}"><td><span class="led ${c.online ? '' : 'warn'}"></span> <b class="mono">${c.def.id}</b> ${esc(cn(c.def))}</td>
      <td class="mono hide-m dim" dir="ltr">rtsp://10.0.${i + 4}.1${i}/stream1</td><td class="mono hide-m nowrap" dir="ltr">${(99.2 + (i * 7 % 8) / 10).toFixed(1)}% · 1080p H.264</td><td class="mono nowrap">${c.fps} ${t('fps')}</td></tr>`).join('')}</tbody>`;
    const c = getCams()[sel]; $('#ed-cam', root).textContent = `${c.def.id} · ${cn(c.def)}`;
    $('#zl', root).innerHTML = [...c.def.zones.map((z, i) => `<li><span class="sev ${z.kind === 'restricted' ? 'crit' : z.kind === 'queue' ? 'warn' : 'info'}">${esc(zoneName(z))}</span>${editable ? `<button class="btn sm ghost" data-del="${i}" aria-label="${L('Delete', 'حذف')}">${icon('x')}</button>` : ''}</li>`),
      c.def.line ? `<li><span class="sev info">${L('Tripwire line', 'خط العدّ')}</span><span class="mono dim">${L('IN', 'دخول')} ${c.in} · ${L('OUT', 'خروج')} ${c.out}</span></li>` : ''].join('');
  };
  root.addEventListener('click', (e) => {
    const r = e.target.closest('tr[data-i]'); if (r) { sel = +r.dataset.i; list(); }
    const tl = e.target.closest('[data-tool]'); if (tl) { tool = tl.dataset.tool; $$('[data-tool]', root).forEach(b => b.setAttribute('aria-pressed', b === tl)); }
    const d = e.target.closest('[data-del]'); if (d) { const c = getCams()[sel]; const z = c.def.zones.splice(+d.dataset.del, 1)[0]; get().zones = get().zones.filter(q => !(q.cam === c.def.id && q.name === z.name)); audit('zone.delete', z.name); list(); }
    if (e.target.closest('#cm-add')) wizard();
  });
  $('#ed-kind', root)?.addEventListener('change', (e) => kind = e.target.value);

  // ---- drawing on the camera frame ----
  const cv = $('#ed', root);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  if (editable) {
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); draft = { a: pt(e), b: pt(e) }; });
    cv.addEventListener('pointermove', (e) => { if (draft) draft.b = pt(e); });
    cv.addEventListener('pointerup', () => {
      if (!draft) return; const { a, b } = draft; draft = null; const c = getCams()[sel];
      const nm = $('#ed-name', root).value.trim();
      if (tool === 'line') { if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .08) return; setLine(c.def.id, { a, b }); audit('line.set', c.def.id); toast(L('Tripwire set — counters reset', 'تم ضبط الخط — أُعيد ضبط العدّادات')); }
      else {
        const w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]); if (w < .04 || h < .04) return;
        const z = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w, h, name: nm || `${L('Zone', 'منطقة')} ${c.def.zones.length + 1}`, kind };
        addZone(c.def.id, z); audit('zone.add', z.name); toast(L('Zone added — live on the wall', 'تمت إضافة المنطقة — ظاهرة على الجدار'));
      }
      $('#ed-name', root).value = ''; list();
    });
  }
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const c = getCams()[sel], ctx = cv.getContext('2d'); drawTile(cv, c);
    if (draft) {
      const sig = getComputedStyle(document.documentElement).getPropertyValue('--signal');
      ctx.strokeStyle = sig; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      if (tool === 'line') { ctx.beginPath(); ctx.moveTo(draft.a[0] * 960, draft.a[1] * 540); ctx.lineTo(draft.b[0] * 960, draft.b[1] * 540); ctx.stroke(); }
      else ctx.strokeRect(draft.a[0] * 960, draft.a[1] * 540, (draft.b[0] - draft.a[0]) * 960, (draft.b[1] - draft.a[1]) * 540);
      ctx.setLineDash([]);
    }
  };
  raf = requestAnimationFrame(loop);

  // ---- add-camera wizard with simulated connection test ----
  function wizard() {
    modal(`<h2>${L('Add camera', 'إضافة كاميرا')}</h2><form id="wz" class="grid2">
      <div class="field"><label class="label">${L('Name', 'الاسم')}</label><input name="name" required placeholder="${L('Loading dock', 'منطقة التحميل')}"></div>
      <div class="field"><label class="label">${L('Protocol', 'البروتوكول')}</label><select name="proto"><option>RTSP</option><option>ONVIF</option><option>NVR (Hikvision / Dahua)</option></select></div>
      <div class="field full"><label class="label">${L('Stream URL', 'رابط البث')}</label><input name="url" class="mono" placeholder="rtsp://192.168.1.50:554/stream1"></div>
      <div class="field"><label class="label">${L('Scene model', 'نموذج المشهد')}</label><select name="scene"><option value="seating">${L('Seating / hall', 'جلوس / قاعة')}</option><option value="door">${L('Entrance', 'مدخل')}</option><option value="corridor">${L('Corridor', 'ممر')}</option><option value="parking">${L('Parking', 'مواقف')}</option></select></div>
      <div class="full"><div class="steps mono" id="wz-s"></div></div>
      <div class="full row"><button class="btn primary" type="submit">${L('Test & add', 'اختبار وإضافة')}</button></div></form>`, (back, close) => {
      $('#wz', back).addEventListener('submit', (e) => {
        e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); if (!fd.name) return;
        const steps = [L('Resolving host', 'تحديد المضيف'), L('Authenticating', 'المصادقة'), L('Negotiating H.264 stream', 'التفاوض على البث'), L('Receiving frames', 'استلام الإطارات')]; let i = 0;
        const el = $('#wz-s', back), tick = () => {
          el.innerHTML = steps.map((s, k) => `<div class="${k < i ? 'ok' : k === i ? 'now' : ''}">${k < i ? '✓' : k === i ? '…' : '·'} ${s}</div>`).join('');
          if (i++ < steps.length) setTimeout(tick, 480); else { const c = addCamera({ name: fd.name, scene: fd.scene }); audit('camera.add', fd.name); close(); sel = getCams().indexOf(c); list(); toast(L('Camera connected', 'تم ربط الكاميرا')); }
        }; tick();
      });
    });
  }
  list();
  return () => cancelAnimationFrame(raf);
}
