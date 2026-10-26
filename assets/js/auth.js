// Auth: uses api/auth.php when the PHP backend is present; falls back to local demo accounts on static hosting.
import { set, get, pref } from './store.js';

export const ACCOUNTS = [
  { email: 'admin@demo.local', role: 'admin', name: 'Layla Haddad', pw: 'Sentra#2026' },
  { email: 'manager@demo.local', role: 'manager', name: 'Omar Al-Rashid', pw: 'Sentra#2026' },
  { email: 'viewer@demo.local', role: 'viewer', name: 'Nora Siddiqui', pw: 'Sentra#2026' },
];
export const CAN = {
  admin: ['*'],
  manager: ['overview', 'wall', 'alerts', 'analytics', 'playback', 'reports', 'cameras:read', 'ack', 'presenter'],
  viewer: ['overview', 'wall', 'alerts', 'analytics'],
};
export const can = (perm) => { const r = get().user?.role; const p = CAN[r] || []; return p.includes('*') || p.includes(perm); };

async function api(path, body) {
  try {
    const r = await fetch('api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    if (!r.ok && r.status !== 401) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;
    return { status: r.status, data: await r.json() };
  } catch { return null; }
}

export async function login(email, pw) {
  const remote = await api('auth.php', { action: 'login', email, password: pw });
  if (remote) {
    if (remote.status === 200 && remote.data.user) return finish(remote.data.user);
    return false;
  }
  const a = ACCOUNTS.find(x => x.email === email.trim().toLowerCase() && x.pw === pw);
  return a ? finish({ email: a.email, role: a.role, name: a.name }) : false;
}
function finish(user) { set({ user }, 'user'); try { sessionStorage.setItem('sentra.user', JSON.stringify(user)); } catch {} return true; }
export function restore() {
  try { const u = JSON.parse(sessionStorage.getItem('sentra.user')); if (u) { set({ user: u }, 'user'); return true; } } catch {}
  return false;
}
export function logout() { api('auth.php', { action: 'logout' }); try { sessionStorage.removeItem('sentra.user'); } catch {} set({ user: null }, 'user'); }

// route access: admin everything; others need the route id or '<id>:read'
export const canView = (id) => can(id) || can(id + ':read');
