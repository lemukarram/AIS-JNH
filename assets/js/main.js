import { get, set, on, pref } from './store.js';
import { loadLang, preload, t, applyDom } from './i18n.js';
import { boot, raise, getPreset } from './engine.js';
import { refreshColors } from './render.js';
import { restore, logout, can, canView } from './auth.js';
import { icon } from './icons.js';
import { $, $$, h, toast, modal, clock, esc, announce } from './ui.js';
import { PRESETS } from './presets.js';

const NAV = [
  { grp: 'nav.operate', items: [['overview', 'grid'], ['wall', 'wall'], ['alerts', 'bell']] },
  { grp: 'nav.analyse', items: [['analytics', 'chart'], ['playback', 'play'], ['reports', 'report']] },
  { grp: 'nav.system', items: [['cameras', 'cam'], ['settings', 'gear'], ['about', 'info']] },
];
const VIEWS = { overview: () => import('./views/overview.js'), wall: () => import('./views/wall.js'), alerts: () => import('./views/alerts.js'), analytics: () => import('./views/analytics.js'), playback: () => import('./views/playback.js'), reports: () => import('./views/reports.js'), cameras: () => import('./views/cameras.js'), settings: () => import('./views/settings.js'), about: () => import('./views/about.js') };
let unmountView = null, loginCleanup = null;
const root = $('#root');

async function init() {
  const lang = pref.read('lang', 'en'), theme = pref.read('theme', 'dark');
  document.documentElement.dataset.theme = theme;
  applyBrand(pref.read('brand', null));
  await preload(); await loadLang(lang);
  boot(pref.read('preset', 'cafe'));
  refreshColors();
  document.addEventListener('toggle-lang', () => switchLang());
  if (restore()) shell(); else showLogin();
}

function showLogin() {
  unmountView?.(); unmountView = null;
  document.title = 'SENTRA — ' + t('login.title');
  import('./views/login.js').then(m => { loginCleanup = m.mount(root, () => { loginCleanup?.(); shell(); }); });
}

function applyBrand(b) {
  if (!b) return;
  Object.assign(get().brand, b);
  if (b.accent) { document.documentElement.style.setProperty('--signal', b.accent); refreshColors(); }
}

function switchLang() { const next = get().lang === 'ar' ? 'en' : 'ar'; loadLang(next).then(() => { if (get().user) shell(true); else showLogin(); }); }
function switchTheme() { const th = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = th; pref.write('theme', th); refreshColors(); const b = $('#b-theme'); if (b) b.innerHTML = icon(th === 'dark' ? 'sun' : 'moon'); }

function route() { const r = (location.hash.replace('#/', '') || 'overview').split('?')[0]; return VIEWS[r] && (r === 'about' || canView(r)) ? r : 'overview'; }

function shell(keepRoute) {
  loginCleanup?.(); unmountView?.(); unmountView = null;
  const P = getPreset(), u = get().user, b = get().brand, th = document.documentElement.dataset.theme;
  root.innerHTML = `
  <div id="app" data-rail="${pref.read('rail', 'e')}">
    <aside class="rail"><div class="brand">${b.logo ? `<img class="logo" src="${esc(b.logo)}" alt="">` : icon('mark', 'mark')}<span>${esc(b.name === 'SENTRA' ? t('app.name') : b.name)}</span></div>
      <nav class="nav" aria-label="Main">${NAV.map(g => `<span class="label grp">${t(g.grp)}</span>${g.items.filter(([id]) => id === 'about' || canView(id)).map(([id, ic]) => `<a href="#/${id}" data-r="${id}">${icon(ic)}<span>${t('nav.' + id)}</span>${id === 'alerts' ? '<b class="count num" id="n-al" hidden></b>' : ''}</a>`).join('')}`).join('')}</nav>
      <div class="rail-foot"><button class="btn primary" id="b-pilot">${icon('arrow', 'flip')}<span>${t('pilot.cta')}</span></button>
        <button class="btn ghost sm" id="b-rail" aria-label="${t('menu')}">${icon('menu')}</button></div></aside>
    <header class="top">
      <button class="search" id="b-cmd" aria-label="${t('search.ph')}">${icon('search')}<span>${t('search.ph')}</span><kbd class="kbd">Ctrl K</kbd></button>
      <span class="grow"></span>
      <span class="pill hide-m" title="${t('health.ok')}"><span class="led"></span><span>${t('demo.badge')}</span></span>
      <span class="clock num hide-m" id="clock"></span>
      <button class="iconbtn" id="b-theme" data-i18n-title="theme">${icon(th === 'dark' ? 'sun' : 'moon')}</button>
      <button class="iconbtn" id="b-lang" data-i18n-title="lang">${icon('globe')}</button>
      ${can('presenter') ? `<button class="iconbtn" id="b-pres" title="Presenter (P)">${icon('presenter')}</button>` : ''}
      <button class="iconbtn" id="b-out" data-i18n-title="signout">${icon('logout')}</button>
    </header>
    <main id="view" tabindex="-1"></main>
    <nav class="bottomnav" aria-label="Main">${[['overview', 'grid'], ['wall', 'wall'], ['alerts', 'bell'], ['analytics', 'chart']].filter(([id]) => canView(id)).map(([id, ic]) => `<a href="#/${id}" data-r="${id}">${icon(ic)}<span>${t('nav.' + id)}</span></a>`).join('')}<a href="#" id="b-pilot-m">${icon('arrow', 'flip')}<span>${t('pilot.cta').split(' ')[0]}</span></a></nav>
  </div>`;
  applyDom(root);
  $('#b-theme').onclick = switchTheme; $('#b-lang').onclick = switchLang;
  $('#b-out').onclick = () => { logout(); showLogin(); };
  $('#b-rail').onclick = () => { const a = $('#app'); a.dataset.rail = a.dataset.rail === 'c' ? 'e' : 'c'; pref.write('rail', a.dataset.rail); };
  $('#b-cmd').onclick = palette; $('#b-pres')?.addEventListener('click', presenter);
  $('#b-pilot').onclick = $('#b-pilot-m').onclick = (e) => { e.preventDefault(); pilot(); };
  navigate();
}

async function navigate() {
  if (!get().user) return;
  const r = route(), view = $('#view'); if (!view) return;
  unmountView?.(); unmountView = null;
  $$('[data-r]').forEach(a => a.toggleAttribute('aria-current', a.dataset.r === r) || (a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  $$('[data-r]').forEach(a => { if (a.dataset.r === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  view.innerHTML = ''; view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  const m = await VIEWS[r]();
  if (route() !== r) return;
  unmountView = m.mount(view);
  document.title = `${t('nav.' + r)} — ${get().brand.name === 'SENTRA' ? t('app.name') : get().brand.name}`;
}
addEventListener('hashchange', navigate);
document.addEventListener('rebrand', () => { const b = get().brand, nm = $('.brand span'); if (nm) nm.textContent = b.name === 'SENTRA' ? t('app.name') : b.name; const lg = $('.brand img.logo'); if (b.logo) { if (lg) lg.src = b.logo; else $('.brand .mark')?.replaceWith(h(`<img class="logo" src="${b.logo}" alt="">`)); } });

// ---- live chrome: clock, alert badge, favicon, announcements ----
on('tick', () => {
  const c = $('#clock'); if (c) c.textContent = clock(get().now);
});
on('alerts', () => {
  const n = get().alerts.filter(a => a.status === 'new').length, b = $('#n-al');
  if (b) { b.hidden = !n; b.textContent = n; }
  document.title = (n ? `(${n}) ` : '') + document.title.replace(/^\(\d+\) /, '');
});
on('alert:new', () => { const a = get().alerts[0]; if (a) announce(`${t('sev.' + a.sev)}: ${t('a.' + a.type)} — ${a.cam}`); });

// ---- pilot lead modal ----
function pilot() {
  modal(`<h2>${t('pilot.cta')}</h2><form id="pf" class="grid2" novalidate>
    <div class="field"><label class="label">Name</label><input name="name" required autocomplete="name"></div>
    <div class="field"><label class="label">Venue</label><input name="venue" required></div>
    <div class="field"><label class="label">Type</label><select name="type"><option>${t('preset.cafe')}</option><option>${t('preset.restaurant')}</option><option>${t('preset.hospital')}</option></select></div>
    <div class="field"><label class="label">Cameras</label><input name="cams" type="number" min="1" max="500" value="8"></div>
    <div class="field"><label class="label">WhatsApp / Phone</label><input name="phone" type="tel" autocomplete="tel"></div>
    <div class="field"><label class="label">Email</label><input name="email" type="email" autocomplete="email" required></div>
    <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
    <div class="field full"><label class="label">Notes</label><textarea name="notes" rows="3"></textarea></div>
    <div class="full row"><button type="submit" class="btn primary">${t('pilot.cta')}</button></div></form>`, (back, close) => {
    $('#pf', back).addEventListener('submit', async (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); if (fd.website) return close();
      if (!fd.name || !fd.email) { toast('Name and email are required'); return; }
      try { await fetch('api/leads.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) }); } catch {}
      const q = pref.read('leads', []); q.push({ ...fd, ts: Date.now() }); pref.write('leads', q);
      close(); toast('✓ ' + t('pilot.cta'));
    });
  });
}

// ---- presenter drawer ----
function presenter() {
  if ($('#presenter')) return $('#presenter').remove();
  const d = h(`<aside id="presenter" class="drawer" aria-label="${t('pres.title')}"><header><span class="label">${t('pres.title')}</span><button class="iconbtn" data-x>${icon('x')}</button></header>
    <p class="dim small">${t('pres.hint')}</p>
    <span class="label">${t('pres.industry')}</span><div class="seg">${Object.keys(PRESETS).map(id => `<button class="btn sm" data-p="${id}" aria-pressed="${id === get().preset}">${t('preset.' + id)}</button>`).join('')}</div>
    <span class="label">${t('pres.trigger')}</span><div class="seg wrap">${getPreset().alerts.map(([a]) => `<button class="btn sm" data-t="${a}">${t('a.' + a)}</button>`).join('')}</div>
    <span class="label">${t('pres.speed')}</span><div class="seg">${[1, 4, 12].map(s => `<button class="btn sm" data-s="${s}" aria-pressed="${get().speed === s}">${s}×</button>`).join('')}</div>
    <span class="label">&nbsp;</span><div class="seg"><button class="btn sm" data-reset>${t('pres.reset')}</button><button class="btn sm" data-kiosk>${t('pres.kiosk')}</button></div></aside>`);
  document.body.append(d);
  d.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-x]')) d.remove();
    if (b.dataset.p) { pref.write('preset', b.dataset.p); boot(b.dataset.p); d.remove(); shell(); toast(t('toast.preset')); }
    if (b.dataset.t) raise(b.dataset.t, { force: true });
    if (b.dataset.s) { set({ speed: +b.dataset.s }, 'speed'); $$('[data-s]', d).forEach(x => x.setAttribute('aria-pressed', x === b)); }
    if (b.matches('[data-reset]')) { boot(get().preset); toast(t('toast.reset')); navigate(); }
    if (b.matches('[data-kiosk]')) { document.documentElement.requestFullscreen?.(); document.body.style.cursor = 'none'; setTimeout(() => document.body.style.cursor = '', 8000); }
  });
}

// ---- command palette ----
function palette() {
  const cmds = [
    ...['overview', 'wall', 'alerts', 'analytics', 'playback', 'reports', 'cameras', 'settings', 'about'].filter(id => id === 'about' || canView(id)).map(id => [t('cmd.go') + ' · ' + t('nav.' + id), () => location.hash = '#/' + id]),
    [t('theme'), switchTheme], [t('lang'), switchLang], [t('pilot.cta'), pilot],
    ...(can('presenter') ? [[t('pres.title'), presenter]] : []),
    ...Object.keys(PRESETS).map(id => [t('pres.industry') + ' · ' + t('preset.' + id), () => { pref.write('preset', id); boot(id); shell(); }]),
  ];
  modal(`<input class="cmd-in" placeholder="${t('search.ph')}" aria-label="${t('search.ph')}"><ul class="cmd-list" role="listbox"></ul>`, (back, close) => {
    const inp = $('input', back), ul = $('ul', back); let i = 0, list = cmds;
    const draw = () => { ul.innerHTML = list.map((c, k) => `<li role="option" data-k="${k}" aria-selected="${k === i}">${esc(c[0])}</li>`).join(''); };
    inp.addEventListener('input', () => { list = cmds.filter(c => c[0].toLowerCase().includes(inp.value.toLowerCase())); i = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { i = Math.min(list.length - 1, i + 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { i = Math.max(0, i - 1); draw(); e.preventDefault(); }
      if (e.key === 'Enter' && list[i]) { close(); list[i][1](); }
    });
    ul.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) { close(); list[+li.dataset.k][1](); } });
    draw();
  });
}

document.addEventListener('keydown', (e) => {
  if (!get().user || e.target.matches('input,textarea,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
  else if (!e.ctrlKey && !e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'p' && can('presenter')) presenter();
    if (k === 'a') location.hash = '#/alerts';
  }
});

init();
