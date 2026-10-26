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
// Inline bilingual copy for screen-specific text: L('English', 'العربية')
export const L = (en, ar) => (get().lang === 'ar' ? ar : en);
export const camName = (def) => def.label || t('camname.' + def.key);

// ---- Saudi / Arabic locale helpers ----
const ZONE_AR = {
  'Door threshold': 'منطقة المدخل', 'Queue zone': 'منطقة الطابور', 'Counter': 'الكاونتر', 'Seating A': 'الجلوس (أ)', 'Seating B': 'الجلوس (ب)',
  'Prep station': 'محطة التحضير', 'Dish area': 'منطقة الغسيل', 'Parking': 'المواقف', 'Reception': 'الاستقبال', 'Waiting area': 'منطقة الانتظار',
  'Restricted — Radiology': 'منطقة محظورة — الأشعة', 'ER triage queue': 'طابور الفرز في الطوارئ', 'Visitor parking': 'مواقف الزوار',
};
export const zoneName = (z) => (get().lang === 'ar' && ZONE_AR[z.name]) || z.name;
export const venueName = (P) => (get().lang === 'ar' && P.venueAr) || P.venue;
// Gregorian dates with Latin digits (the Saudi business default); Hijri shown separately in the top bar.
export const locale = () => (get().lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB');
export const fmtDate = (d, o = { day: '2-digit', month: 'short' }) => new Intl.DateTimeFormat(locale(), o).format(d);
export const fmtDateTime = (d) => new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: get().lang === 'ar' }).format(d);
export const hijri = (d) => new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
// Arabic number agreement: [singular, dual, 3–10 (plural), 11+ (singular accusative)]
export const plAr = (v, [one, two, few, many]) => { v = Math.abs(Math.round(v)); return v === 1 ? one : v === 2 ? two : v >= 3 && v <= 10 ? `${n(v)} ${few}` : `${n(v)} ${many}`; };
export const days = (v) => (get().lang === 'ar' ? (v === 1 ? 'يوم' : v === 2 ? 'يومان' : plAr(v, ['يوم', 'يومان', 'أيام', 'يومًا'])) : `${v} days`);
export const ltr = (s) => `<bdi dir="ltr">${s}</bdi>`;
export const clsWord = (c, staff) => (get().lang === 'ar' ? { person: staff ? 'موظف' : 'شخص', bag: 'حقيبة', car: 'مركبة', truck: 'شاحنة' }[c] || c : (staff ? 'staff' : c));
