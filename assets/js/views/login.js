import { t, applyDom } from '../i18n.js';
import { getCams } from '../engine.js';
import { drawTile } from '../render.js';
import { login, ACCOUNTS } from '../auth.js';
import { icon } from '../icons.js';
import { $, $$ } from '../ui.js';

export function mount(root, done) {
  root.innerHTML = `
  <div class="login">
    <section class="login-art" aria-hidden="true">
      <div class="mosaic">${[0, 1, 2, 3, 4, 5].map(i => `<div class="mtile"><canvas width="480" height="270"></canvas><span class="mono">CAM-0${(i % 5) + 1}</span><i class="tick tl"></i><i class="tick br"></i></div>`).join('')}</div>
      <div class="login-art-foot mono"><span class="led"></span> <span id="lg-clock"></span> · 5 / 5 STREAMS · <span data-i18n="demo.badge"></span></div>
    </section>
    <section class="login-form">
      <div class="login-top"><button class="btn ghost sm" id="lg-lang">العربية / EN</button></div>
      <form id="lf" novalidate>
        <div class="brand big">${icon('mark', 'mark')}<span data-i18n="app.name"></span></div>
        <h1 data-i18n="login.title"></h1>
        <p class="sub" data-i18n="login.sub"></p>
        <div class="field"><label class="label" for="em" data-i18n="login.email"></label><input id="em" type="email" autocomplete="username" required></div>
        <div class="field"><label class="label" for="pw" data-i18n="login.password"></label><input id="pw" type="password" autocomplete="current-password" required></div>
        <div class="row"><label class="chk"><input type="checkbox" checked> <span data-i18n="login.remember"></span></label><a href="#" class="lnk" id="forgot" data-i18n="login.forgot"></a></div>
        <p class="err" id="err" role="alert" hidden></p>
        <button class="btn primary big" type="submit"><span data-i18n="login.submit"></span> ${icon('arrow', 'flip')}</button>
        <div class="demo"><span class="label" data-i18n="login.demo"></span>
          <div class="chips">${ACCOUNTS.map(a => `<button type="button" class="chip" data-e="${a.email}" data-p="${a.pw}"><b data-i18n="role.${a.role}"></b><span class="mono">${a.email}</span></button>`).join('')}</div>
        </div>
      </form>
    </section>
  </div>`;
  applyDom(root);
  const cv = $$('canvas', root);
  let raf, last = 0;
  const loop = (ts) => {
    raf = requestAnimationFrame(loop);
    if (ts - last < 66) return; last = ts;
    const cams = getCams();
    cv.forEach((c, i) => drawTile(c, cams[i % cams.length], { labels: false }));
    const el = $('#lg-clock'); if (el) el.textContent = new Date().toTimeString().slice(0, 8);
  };
  raf = requestAnimationFrame(loop);

  $$('.chip', root).forEach(b => b.addEventListener('click', () => { $('#em').value = b.dataset.e; $('#pw').value = b.dataset.p; $('#lf button[type=submit]').focus(); }));
  $('#lg-lang').addEventListener('click', () => document.dispatchEvent(new CustomEvent('toggle-lang')));
  $('#forgot').addEventListener('click', (e) => { e.preventDefault(); import('../ui.js').then(u => u.toast(t('login.forgot') + ' ✓')); });
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await login($('#em').value, $('#pw').value);
    if (!ok) { const er = $('#err'); er.textContent = ok === 'rate' ? t('login.rate') : t('login.err'); er.hidden = false; $('.login-form form').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 200 }); return; }
    cancelAnimationFrame(raf); done();
  });
  return () => cancelAnimationFrame(raf);
}
