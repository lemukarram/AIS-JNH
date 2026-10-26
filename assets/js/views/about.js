import { t } from '../i18n.js';

// Copy lives here (not in lang files) so sales can edit it in one place; AR below is the native text.
const COPY = {
  en: {
    h: 'About this demo', lead: 'You are looking at a demonstration environment. This page says plainly what is live and what is simulated.',
    live: ['The interface, rules engine, alert workflow, role permissions and exports are the real product behaviour.', 'Counters, alerts and KPIs are driven by one shared state, so numbers agree on every screen.'],
    sim: ['Camera feeds are generated scenes or looped sample footage, not your cameras.', 'Detections and alerts are simulated (or pre-computed from sample footage) for illustration.', 'Historical data is synthetic, seeded to resemble a weekly pattern.'],
    pilot: ['Connect to existing CCTV/NVR over RTSP or ONVIF — no new cameras required in most cases.', 'Run on an edge box on-site or in your cloud; video can stay inside your network.', 'Privacy by design: counts and behaviour only. No facial recognition, no identity features.', 'Typical timeline: site survey, 1–2 week pilot on a few cameras, then review of measured results.'],
    cols: ['Live', 'Simulated here', 'In a real pilot'],
  },
  ar: {
    h: 'عن هذا العرض', lead: 'أنت الآن في بيئة تجريبية. توضّح هذه الصفحة بصراحة ما هو حقيقي وما هو محاكى.',
    live: ['الواجهة ومحرّك القواعد وسير عمل التنبيهات وصلاحيات المستخدمين والتصدير تمثّل سلوك المنتج الفعلي.', 'العدّادات والتنبيهات والمؤشرات تعتمد على حالة مشتركة واحدة، لذلك تتطابق الأرقام في كل الشاشات.'],
    sim: ['بثّ الكاميرات مشاهد مُولَّدة أو مقاطع عيّنة متكررة، وليست كاميراتكم.', 'الاكتشافات والتنبيهات محاكاة (أو محسوبة مسبقاً من مقاطع العيّنة) لغرض الإيضاح.', 'البيانات التاريخية اصطناعية وتحاكي نمطاً أسبوعياً.'],
    pilot: ['الربط بكاميرات المراقبة الحالية عبر RTSP أو ONVIF — دون الحاجة لكاميرات جديدة في الغالب.', 'التشغيل على جهاز طرفي داخل الموقع أو في سحابتكم، ويمكن أن يبقى الفيديو داخل شبكتكم.', 'الخصوصية أولاً: عدّ وسلوك فقط، دون التعرّف على الوجوه أو الهوية.', 'الجدول المعتاد: معاينة الموقع، ثم تجربة من أسبوع إلى أسبوعين على عدة كاميرات، ثم مراجعة النتائج المقاسة.'],
    cols: ['حقيقي', 'محاكى هنا', 'في التجربة الفعلية'],
  },
};

export function mount(root) {
  const c = COPY[document.documentElement.lang] || COPY.en;
  const col = (title, items, cls) => `<section class="panel about-col ${cls}"><header><span class="label">${title}</span></header><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></section>`;
  root.innerHTML = `<div class="page"><div class="page-head"><div><span class="label">${t('nav.system')}</span><h1>${c.h}</h1></div></div>
    <p class="lead">${c.lead}</p><div class="about-grid">${col(c.cols[0], c.live, 'ok')}${col(c.cols[1], c.sim, 'warn')}${col(c.cols[2], c.pilot, 'info')}</div></div>`;
  return () => {};
}
