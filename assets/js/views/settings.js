import { get, set, pref, on } from '../store.js';
import { t, n, L, venueName, fmtDateTime, days as dayWord } from '../i18n.js';
import { getPreset, boot, hourCurve } from '../engine.js';
import { $, $$, esc, toast, clock, downloadCSV } from '../ui.js';
import { audit, auditLog } from '../audit.js';
import { ACCOUNTS, CAN } from '../auth.js';
import { PRESETS, ALERT_TYPES } from '../presets.js';
import { icon } from '../icons.js';

const TABS = [['brand', 'Branding', 'الهوية'], ['venue', 'Venue', 'الموقع'], ['ai', 'Detection & rules', 'الاكتشاف والقواعد'], ['users', 'Users & roles', 'المستخدمون والأدوار'], ['integ', 'Integrations', 'التكاملات'], ['health', 'System health', 'صحة النظام'], ['audit', 'Audit log', 'سجل التدقيق'], ['leads', 'Leads', 'العملاء المحتملون']];

export function mount(root) {
  let tab = 'brand', timer;
  root.innerHTML = `<div class="page st"><div class="page-head"><div><span class="label">${t('nav.system')}</span><h1>${t('nav.settings')}</h1></div></div>
    <div class="st-grid"><div class="tabs" role="tablist">${TABS.map(x => `<button role="tab" data-tab="${x[0]}" aria-selected="${x[0] === tab}">${L(x[1], x[2])}</button>`).join('')}</div><section class="panel st-body" id="st-body" role="tabpanel"></section></div></div>`;
  const body = $('#st-body', root);
  const P = () => getPreset();

  const views = {
    brand() {
      const b = get().brand;
      body.innerHTML = `<div class="form"><div class="field"><label class="label" for="b-name">${L('Product name', 'اسم المنتج')}</label><input id="b-name" value="${esc(b.name)}"></div>
        <div class="field"><label class="label" for="b-venue">${L('Venue name', 'اسم الموقع')}</label><input id="b-venue" value="${esc(venueName(P()))}"></div>
        <div class="field"><label class="label" for="b-col">${L('Accent colour', 'اللون المميز')}</label><div class="row"><input id="b-col" type="color" value="${b.accent}" class="colorin"><span class="mono">${b.accent}</span><button class="btn sm" id="b-reset">${L('Reset', 'استعادة')}</button></div></div>
        <div class="field"><label class="label" for="b-logo">${L('Logo (PNG/SVG)', 'الشعار')}</label><input id="b-logo" type="file" accept="image/png,image/svg+xml,image/jpeg"></div>
        <p class="dim small">${L('Changes apply instantly across the app — rebrand for each prospect in seconds.', 'تُطبّق التغييرات فوراً في كل الشاشات — أعد التسمية لكل عميل في ثوانٍ.')}</p></div>`;
      const save = () => { pref.write('brand', { name: b.name, accent: b.accent, logo: b.logo }); };
      const refresh = () => { document.dispatchEvent(new CustomEvent('rebrand')); };
      $('#b-name', body).oninput = (e) => { b.name = e.target.value || 'SENTRA'; save(); refresh(); };
      $('#b-venue', body).oninput = (e) => { P().venue = P().venueAr = e.target.value; refresh(); };
      $('#b-col', body).oninput = (e) => { b.accent = e.target.value; document.documentElement.style.setProperty('--signal', b.accent); const lum = parseInt(b.accent.slice(1, 3), 16) * .3 + parseInt(b.accent.slice(3, 5), 16) * .6 + parseInt(b.accent.slice(5), 16) * .1; document.documentElement.style.setProperty('--signal-ink', lum > 120 ? '#10140A' : '#FFFFFF'); $('.mono', body).textContent = b.accent; save(); audit('brand.color', b.accent); };
      $('#b-reset', body).onclick = () => { b.accent = '#C6F432'; document.documentElement.style.setProperty('--signal', b.accent); document.documentElement.style.setProperty('--signal-ink', '#10140A'); save(); views.brand(); };
      $('#b-logo', body).onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { b.logo = r.result; save(); refresh(); audit('brand.logo', f.name); toast(L('Logo updated', 'تم تحديث الشعار')); }; r.readAsDataURL(f); };
    },
    venue() {
      body.innerHTML = `<div class="form"><span class="label">${L('Industry preset', 'قطاع النشاط')}</span><div class="seg">${Object.keys(PRESETS).map(id => `<button class="btn" data-p="${id}" aria-pressed="${id === get().preset}">${t('preset.' + id)}</button>`).join('')}</div>
        <dl class="mono"><dt>${L('Venue', 'الموقع')}</dt><dd>${esc(venueName(P()))}</dd><dt>${L('Capacity', 'السعة')}</dt><dd>${n(P().capacity)}</dd><dt>${L('Cameras', 'الكاميرات')}</dt><dd>${get().cams.length}</dd><dt>${L('Timezone', 'المنطقة الزمنية')}</dt><dd>Asia/Riyadh (UTC+3)</dd></dl></div>`;
      body.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { pref.write('preset', b.dataset.p); boot(b.dataset.p); audit('preset', b.dataset.p); toast(t('toast.preset')); views.venue(); } };
    },
    ai() {
      const g = get(); g.modules ||= {}; const sens = g.sensitivity ?? 50;
      body.innerHTML = `<div class="form"><div class="field"><label class="label" for="s-q">${L('Queue alert threshold', 'حد تنبيه الطابور')}: <b class="mono" id="s-qv">${g.queueLimit ?? 5}</b></label><input type="range" id="s-q" min="2" max="12" value="${g.queueLimit ?? 5}"></div>
        <div class="field"><label class="label" for="s-t">${L('Simulated traffic level', 'مستوى الحركة المحاكاة')}: <b class="mono" id="s-tv">${Math.round((g.traffic ?? 1) * 100)}%</b></label><input type="range" id="s-t" min="30" max="250" value="${Math.round((g.traffic ?? 1) * 100)}"></div>
        <div class="field"><label class="label">${L('Detection modules', 'وحدات الاكتشاف')}</label><div class="mods">${P().alerts.map(([a]) => `<label class="chk"><input type="checkbox" data-m="${a}" ${g.modules[a] === false ? '' : 'checked'}> ${t('a.' + a)}</label>`).join('')}</div></div>
        <label class="chk"><input type="checkbox" id="s-blur" ${g.flags.blur ? 'checked' : ''}> ${L('Blur faces by default (privacy)', 'طمس الوجوه افتراضياً (الخصوصية)')}</label>
        <div class="field"><label class="label">${L('Retention', 'مدة الاحتفاظ')}</label><select class="sel"><option>${dayWord(7)}</option><option selected>${dayWord(30)}</option><option>${dayWord(90)}</option></select></div>
        <div class="field"><label class="label">${L('Notification channels (UI only)', 'قنوات الإشعار (واجهة فقط)')}</label><div class="mods">${['Email', 'SMS', 'WhatsApp', 'Webhook'].map(c => `<label class="chk"><input type="checkbox" ${c === 'Email' ? 'checked' : ''}> ${c}</label>`).join('')}</div></div>
        <div class="field"><label class="label">${L('Model', 'النموذج')}</label><select class="sel" disabled><option>YOLOv8n · person/vehicle/bag</option></select></div>
        <p class="dim small">${L('No facial recognition or biometric identification. Counts and behaviour only.', 'لا تعرّف على الوجوه ولا بيانات حيوية. عدّ وسلوك فقط.')}</p></div>`;
      $('#s-q', body).oninput = (e) => { g.queueLimit = +e.target.value; $('#s-qv', body).textContent = e.target.value; };
      $('#s-t', body).oninput = (e) => { g.traffic = e.target.value / 100; $('#s-tv', body).textContent = e.target.value + '%'; };
      body.onchange = (e) => { if (e.target.dataset.m) { g.modules[e.target.dataset.m] = e.target.checked; audit('rule.toggle', e.target.dataset.m + '=' + e.target.checked); }
        if (e.target.id === 's-blur') g.flags.blur = e.target.checked; };
    },
    users() {
      const roles = ['admin', 'manager', 'viewer'], cap = { admin: L('Everything, incl. settings, cameras, leads', 'كل شيء بما في ذلك الإعدادات والكاميرات'), manager: L('Operate: wall, alerts, analytics, reports, playback', 'التشغيل: الجدار والتنبيهات والتحليلات والتقارير'), viewer: L('Read-only: overview, wall, alerts, analytics', 'قراءة فقط') };
      body.innerHTML = `<table class="tbl"><thead><tr><th>${L('User', 'المستخدم')}</th><th>${L('Email', 'البريد')}</th><th>${L('Role', 'الدور')}</th></tr></thead><tbody>${ACCOUNTS.map(a => `<tr><td>${esc(a.name)}</td><td class="mono">${a.email}</td><td><span class="st">${t('role.' + a.role)}</span></td></tr>`).join('')}</tbody></table>
        <div class="roles">${roles.map(r => `<div><b>${t('role.' + r)}</b><p class="dim small">${cap[r]}</p></div>`).join('')}</div>`;
    },
    integ() {
      const I = [['POS', L('Sales & receipts', 'المبيعات')], ['HIS / HL7-FHIR', L('Hospital information system', 'نظام معلومات المستشفى')], ['WhatsApp Business', L('Alert delivery', 'إرسال التنبيهات')], ['Slack', L('Ops channel', 'قناة التشغيل')], ['Webhook', L('Custom endpoint', 'نقطة مخصصة')]];
      const on_ = pref.read('integ', {});
      body.innerHTML = `<ul class="integ">${I.map(([k, d]) => `<li><div><b>${k}</b><span class="dim small">${d}</span></div><button class="btn sm" data-i="${k}" aria-pressed="${!!on_[k]}">${on_[k] ? L('Connected', 'متصل') : L('Connect', 'ربط')}</button></li>`).join('')}</ul>
        <div class="field"><label class="label">${L('API key', 'مفتاح API')}</label><div class="row"><input class="mono" readonly value="sk_demo_••••••••••••••••••••a91f"><button class="btn sm" id="k-new">${L('Regenerate', 'إعادة إنشاء')}</button></div></div>`;
      body.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { on_[b.dataset.i] = !on_[b.dataset.i]; pref.write('integ', on_); audit('integration', b.dataset.i); toast(on_[b.dataset.i] ? L('Connected (simulated)', 'تم الربط (محاكاة)') : L('Disconnected', 'تم الفصل')); views.integ(); } if (e.target.closest('#k-new')) { audit('apikey.regen'); toast(L('New key generated (simulated)', 'تم إنشاء مفتاح (محاكاة)')); } };
    },
    health() {
      const draw = () => { const k = get().kpi || {}, m = (l, v, u, w) => `<div class="hl"><span class="label">${l}</span><b class="num">${v}<small>${u}</small></b><i class="bar" style="--w:${w}"></i></div>`; const ph = performance.now() / 1000;
        body.innerHTML = `<div class="health">${m('GPU / NPU temp', Math.round(58 + Math.sin(ph / 7) * 4), '°C', .6)}${m('CPU', Math.round(34 + Math.sin(ph / 5) * 8), '%', .4)}${m(L('Inference FPS', 'إطارات الاستدلال'), k.fps || 0, ' fps', (k.fps || 0) / 40)}${m(L('Latency', 'التأخير'), k.latency || 0, ' ms', (k.latency || 0) / 300)}${m(L('Queue depth', 'عمق الطابور'), Math.max(0, Math.round(2 + Math.sin(ph / 3) * 2)), '', .2)}${m(L('Storage', 'التخزين'), '412', ' / 2000 GB', .21)}${m(L('Cameras online', 'كاميرات متصلة'), `${k.cams}/${k.camsTotal}`, '', (k.cams || 0) / (k.camsTotal || 1))}${m(L('Uptime', 'مدة التشغيل'), '14d 06h', '', .9)}</div>`; };
      draw(); timer = setInterval(() => tab === 'health' && draw(), 2000);
    },
    audit() {
      const log = auditLog();
      body.innerHTML = `<div class="row" style="padding:12px 16px"><span class="label">${L('Recorded by the app', 'يسجّله التطبيق')}</span><button class="btn sm" id="a-csv">CSV</button></div>
        <table class="tbl"><thead><tr><th>${L('Time', 'الوقت')}</th><th>${L('User', 'المستخدم')}</th><th>${L('Action', 'الإجراء')}</th><th>${L('Detail', 'التفاصيل')}</th></tr></thead><tbody>${log.length ? log.map(e => `<tr><td class="mono">${fmtDateTime(new Date(e.ts))}</td><td class="mono">${esc(e.user)}</td><td class="mono">${esc(e.action)}</td><td>${esc(e.detail)}</td></tr>`).join('') : `<tr><td colspan="4" class="empty">${t('al.empty')}</td></tr>`}</tbody></table>`;
      $('#a-csv', body)?.addEventListener('click', () => downloadCSV('audit.csv', [[L('Time', 'الوقت'), L('User', 'المستخدم'), L('Action', 'الإجراء'), L('Detail', 'التفاصيل')], ...log.map(e => [new Date(e.ts).toISOString(), e.user, e.action, e.detail])]));
    },
    async leads() {
      let leads = pref.read('leads', []);
      try { const r = await fetch('api/leads.php', { credentials: 'same-origin' }); if (r.ok && (r.headers.get('content-type') || '').includes('json')) leads = (await r.json()).leads || leads; } catch {}
      body.innerHTML = `<div class="row" style="padding:12px 16px"><span class="label">${n(leads.length)} ${L('leads', 'عميل محتمل')}</span><button class="btn sm" id="l-csv">CSV</button></div>
        <table class="tbl"><thead><tr><th>${L('Name', 'الاسم')}</th><th>${L('Venue', 'الموقع')}</th><th class="hide-m">${L('Type', 'النوع')}</th><th class="hide-m">${L('Cameras', 'الكاميرات')}</th><th>${L('Contact', 'التواصل')}</th></tr></thead><tbody>${leads.length ? leads.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.venue || '')}</td><td class="hide-m">${esc(l.type || '')}</td><td class="mono hide-m">${esc(l.cams || '')}</td><td class="mono">${esc(l.email || '')}<br>${esc(l.phone || '')}</td></tr>`).join('') : `<tr><td colspan="5" class="empty">${t('al.empty')}</td></tr>`}</tbody></table>`;
      $('#l-csv', body)?.addEventListener('click', () => downloadCSV('leads.csv', [[L('Name', 'الاسم'), L('Venue', 'الموقع'), L('Type', 'النوع'), L('Cameras', 'الكاميرات'), L('Phone', 'الجوال'), L('Email', 'البريد'), L('Notes', 'ملاحظات')], ...leads.map(l => [l.name, l.venue, l.type, l.cams, l.phone, l.email, l.notes || ''])]));
    },
  };
  const open = (id) => { clearInterval(timer); tab = id; body.onclick = body.onchange = null; $$('[data-tab]', root).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id)); views[id](); };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) open(b.dataset.tab); });
  open('brand');
  return () => clearInterval(timer);
}
