// Thin fetch wrapper for the optional PHP backend. Returns null when the backend is absent (static hosting) so callers can fall back.
let csrf = document.querySelector('meta[name=csrf]')?.content || '';
export const hasBackend = () => document.querySelector('meta[name=backend]')?.content === 'php';
export const setCsrf = (t) => { if (t) csrf = t; };

export async function post(path, body) {
  try {
    const r = await fetch('api/' + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
    if (!(r.headers.get('content-type') || '').includes('json')) return null;
    return { status: r.status, data: await r.json() };
  } catch { return null; }
}
export async function get(path) {
  try {
    const r = await fetch('api/' + path, { credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    return await r.json();
  } catch { return null; }
}
