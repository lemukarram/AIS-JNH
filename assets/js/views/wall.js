import { get, on, set, pref } from '../store.js';
import { t, n, L, applyDom, camName as cn } from '../i18n.js';
import { getCams } from '../engine.js';
import { drawTile } from '../render.js';
import { $, $$, clock, setNum, visible } from '../ui.js';
import { icon } from '../icons.js';
import * as AL from './alertlib.js';

const LAYOUTS = ['spot', 'quad', 'mix', 'single'];

export function mount(root) {
  let layout = pref.read('layout', 'spot'), focus = 0, raf, offs = [];
  const cams = () => getCams();
  root.innerHTML = `
  <div class="wall">
    <div class="wall-main">
      <div class="wall-bar">
        <div class="seg" role="group" aria-label="${L('Layout', 'التخطيط')}">${LAYOUTS.map(l => `<button class="btn sm" data-l="${l}" aria-pressed="${l === layout}">${t('wall.layout.' + (l === 'spot' ? 'spot' : l))}</button>`).join('')}</div>
        <div class="seg" role="group">${['boxes', 'trails', 'zones', 'heat', 'blur', 'skeleton'].map(k => `<button class="btn sm" data-f="${k}" aria-pressed="${get().flags[k]}">${t('wall.' + k)}</button>`).join('')}</div>
        <span class="grow"></span><span class="kbd">1–5</span><span class="kbd">G</span><span class="kbd">F</span>
      </div>
      <div class="tiles" data-layout="${layout}"></div>
    </div>
    <aside class="wall-feed panel" aria-label="${t('wall.alertfeed')}">
      <header><span class="label">${t('wall.alertfeed')}</span><span class="pill"><span class="led"></span><b class="num" id="wf-n">0</b></span></header>
      <ul class="alist" id="wf"></ul>
    </aside>
  </div>`;
  const tilesEl = $('.tiles', root);

  function build() {
    const cs = cams();
    tilesEl.dataset.layout = layout;
    const order = layout === 'single' ? [focus] : layout === 'quad' ? [0, 1, 2, 3] : [focus, ...cs.map((_, i) => i).filter(i => i !== focus)];
    tilesEl.innerHTML = order.map((ci, pos) => {
      const c = cs[ci];
      return `<figure class="tile ${pos === 0 && layout !== 'quad' ? 'hero' : ''}" data-cam="${ci}" tabindex="0" aria-label="${c.def.id} ${t('cam.live')}">
        <canvas width="640" height="360"></canvas>
        <i class="tick tl"></i><i class="tick tr"></i><i class="tick bl"></i><i class="tick br"></i>
        <div class="tile-top"><span class="tname"><span class="led"></span><b class="mono">${c.def.id}</b> ${camName(c)}</span>
          <span class="tmeta mono"><span class="badge-live">${t('cam.live')}</span><span data-m="fps"></span><span data-m="lat"></span><span class="hide-m" data-m="br"></span></span></div>
        <div class="tile-hud mono" dir="ltr">YOLOv8n · <span data-m="ms"></span> ms/f</div>
        <div class="tile-ts mono" dir="ltr" data-m="ts"></div>
        <div class="tile-bot mono"><span>${t('wall.in')} <b data-m="in">0</b></span><span>${t('wall.out')} <b data-m="out">0</b></span><span>${t('wall.now')} <b data-m="now">0</b></span></div>
      </figure>`;
    }).join('');
    $$('.tile', tilesEl).forEach(el => {
      el.addEventListener('click', () => { focus = +el.dataset.cam; if (layout !== 'single' && layout !== 'quad') build(); else if (layout === 'quad') { layout = 'spot'; sync(); build(); } });
      el.addEventListener('dblclick', () => el.requestFullscreen?.());
    });
  }
  const camName = (c) => cn(c.def);
  function sync() {
    $$('[data-l]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.l === layout));
    pref.write('layout', layout);
  }

  root.addEventListener('click', (e) => {
    const l = e.target.closest('[data-l]'); if (l) { layout = l.dataset.l; sync(); build(); }
    const f = e.target.closest('[data-f]'); if (f) { const fl = get().flags; fl[f.dataset.f] = !fl[f.dataset.f]; f.setAttribute('aria-pressed', fl[f.dataset.f]); }
  });
  const key = (e) => {
    if (e.target.matches?.('input,textarea,select') || e.ctrlKey || e.metaKey) return;
    if (/^[1-5]$/.test(e.key)) { focus = +e.key - 1; if (layout === 'quad') layout = 'spot'; sync(); build(); }
    if (e.key.toLowerCase() === 'g') { layout = LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % 4]; sync(); build(); }
    if (e.key.toLowerCase() === 'f') (document.fullscreenElement ? document.exitFullscreen() : $('.tile.hero', root)?.requestFullscreen?.());
  };
  document.addEventListener('keydown', key);

  // alert feed
  const feed = $('#wf', root);
  const renderFeed = () => {
    const al = get().alerts.slice(0, 30);
    feed.innerHTML = al.length ? al.map(a => AL.row(a)).join('') : `<li class="empty">${t('wall.empty')}</li>`;
    $('#wf-n', root).textContent = n(get().alerts.filter(a => a.status === 'new').length);
    drawSnaps();
  };
  const drawSnaps = () => $$('canvas.snap', feed).forEach(cv => {
    const a = get().alerts.find(x => x.id === +cv.dataset.snap); const cam = cams().find(c => c.def.id === a?.cam); if (!cam) return;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#10161b'; ctx.fillRect(0, 0, 96, 54);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; for (const z of cam.def.zones) ctx.strokeRect(z.x * 96, z.y * 54, z.w * 96, z.h * 54);
    ctx.fillStyle = '#556572'; for (const g of cam.agents) ctx.fillRect(g.x * 96 - 1, g.y * 54 - 2, 3, 5);
    const col = getComputedStyle(document.documentElement).getPropertyValue(a.sev === 'crit' ? '--crit' : '--signal');
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(a.at[0] * 96 - 8, a.at[1] * 54 - 10, 16, 20);
  });
  AL.wire(feed);
  offs.push(on('alerts', renderFeed), on('lang', () => { applyDom(root); }));
  renderFeed();
  build();

  // render loop (pauses when hidden / off-screen)
  let last = 0;
  const loop = (ts) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden || ts - last < 33) return; last = ts;
    const cs = cams();
    for (const el of $$('.tile', tilesEl)) {
      if (!visible(el)) continue;
      const c = cs[+el.dataset.cam];
      drawTile($('canvas', el), c);
      const m = (k) => $(`[data-m=${k}]`, el);
      m('fps').textContent = c.online ? `${c.fps} ${t('fps')}` : '—';
      m('lat').textContent = c.online ? `${c.latency} ${L('ms', 'مللي ث')}` : '—';
      m('br').textContent = `${(c.bitrate / 1000).toFixed(1)} ${L('Mbps', 'م.ب/ث')}`;
      m('ms').textContent = (1000 / c.fps * .62).toFixed(1);
      m('ts').textContent = new Date(get().now).toISOString().slice(0, 10) + ' ' + new Date(get().now).toTimeString().slice(0, 8) + ' · ' + c.def.id;
      setNum(m('in'), c.in); setNum(m('out'), c.out); setNum(m('now'), c.agents.filter(a => a.cls === 'person').length);
      const led = $('.led', el); led.className = 'led' + (c.online ? '' : ' warn');
      el.classList.toggle('alerting', !!(c.lock && c.lock.until > performance.now() / 1000 - 1e9 && c.flash > .4));
    }
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); offs.forEach(f => f()); };
}
