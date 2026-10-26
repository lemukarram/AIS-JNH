import { get, pref } from './store.js';
// Audit log: written by the app on every meaningful action. Mirrors to api/audit.php when the PHP backend exists.
export function audit(action, detail = '') {
  const e = { ts: Date.now(), user: get().user?.email || 'anon', action, detail };
  const log = pref.read('audit', []); log.unshift(e); pref.write('audit', log.slice(0, 300));
  fetch('api/audit.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e), credentials: 'same-origin' }).catch(() => {});
}
export const auditLog = () => pref.read('audit', []);
