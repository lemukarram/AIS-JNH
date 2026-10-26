import { get, set, pref } from './store.js';
const dict = {};
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export async function loadLang(lang) {
  if (!dict[lang]) dict[lang] = await (await fetch(`lang/${lang}.json`)).json();
  const rtl = lang === 'ar';
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.style.setProperty('--dir', rtl ? -1 : 1);
  pref.write('lang', lang);
  set({ lang }, 'lang');
}
export function t(key, vars) {
  const s = (dict[get().lang] || {})[key] ?? (dict.en || {})[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
}
export function preload() { return Promise.all(['en', 'ar'].map(l => dict[l] ? 0 : fetch(`lang/${l}.json`).then(r => r.json()).then(j => dict[l] = j))); }
// Numbers: Latin digits by default, Arabic-Indic only if user opted in.
export function n(v, opts) {
  const s = new Intl.NumberFormat('en-US', opts).format(v);
  return get().lang === 'ar' && pref.read('arDigits', false) ? s.replace(/\d/g, d => AR_DIGITS[d]) : s;
}
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); });
}
