# SENTRA — deployment guide (cPanel / shared PHP)

## Requirements
- PHP 7.4 – 8.3 with `pdo`, `pdo_sqlite` (or `pdo_mysql`) and `mbstring`
- Apache with `.htaccess` (mod_rewrite). No Node, Python, Composer or daemons on the server.
- Upload size is small: fonts ≈ 0.4 MB, code < 1 MB, plus any videos you add (≤ 3.5 MB each).

## 1. Upload
1. Zip the project folder (leave out `source_videos/` and `.git`).
2. cPanel → **File Manager** → `public_html/demo` → Upload → Extract.
3. Folder can be anywhere (`/demo/`, `/pilot/`): every URL is relative.

## 2. Install (under 2 minutes)
1. Optional: edit `config.php` (lead email, `DEMO_BADGE`, MySQL instead of SQLite).
2. Open `https://your-site.com/demo/install.php`.
3. All checks should show ✓. Pick a demo password (or leave blank for the `config.php` default) → **Create database & seed demo data**.
4. Click **Delete install.php now**. If it can't, delete it in File Manager.
5. Open `https://your-site.com/demo/` and log in.

Accounts (all use the password you chose): `admin@demo.local`, `manager@demo.local`, `viewer@demo.local`.
Default password if you left it blank: `Sentra#2026` — change it for any public deployment.

## 3. Roles
| Role | Can do |
|---|---|
| admin | everything: settings, cameras & zones, leads, audit log, presenter |
| manager | wall, alerts (acknowledge), analytics, playback, reports, presenter; cameras read-only |
| viewer | overview, wall, alerts (read), analytics |

The API enforces roles too (`api/leads.php` and `api/audit.php` GET are admin-only).

## 4. White-label for a prospect (≈30 s)
Settings → **Branding**: product name, accent colour, logo. Venue name: Settings → Branding → *Venue name*. Applies instantly. Brand settings are stored per browser; to bake defaults for everyone, edit `brand` in `assets/js/store.js`.

## 5. Swap the videos (optional)
The demo runs fully without video (procedural simulation). To use sample footage:
1. `tools/compress_videos.sh raw_clips/ assets/video/` → `cam1.mp4 … cam5.mp4`.
2. Keep originals in `source_videos/` (never uploaded; blocked by `.htaccess`).
3. Pre-compute detections on your laptop: `pip install -r tools/requirements.txt` then
   `python tools/bake_tracks.py --videos source_videos --out assets/tracks` (resumable; `--force` to redo).
   Edit `tools/zones.json` first to define zones/tripwires per camera.

> Pipeline A is wired: if `assets/video/camN.mp4` and `assets/tracks/camN.json` both exist, that camera plays the footage with boxes, trails, zones and counters replayed from the baked tracks (frame-synced via `requestVideoFrameCallback`, falling back to `currentTime`). Any camera missing either file, or whose video fails to load, silently stays on the simulation. Verified with a synthetic clip; not yet with real YOLO output.

## 6. Reset the demo
- Presenter drawer (`P`) → **Reset data**: restarts the simulation and clears alerts.
- Clear leads/audit: delete `data/sentra.sqlite` and `data/installed.lock`, then run `install.php` again.

## 7. Security notes
Passwords are hashed (`password_hash`), queries use prepared statements, sessions are `HttpOnly` + `SameSite=Lax` (+`Secure` on HTTPS), state-changing calls need a CSRF token, login and lead forms are rate-limited, and `.htaccess` blocks `/data`, `/app`, `/tools`, `config.php`. Serve over HTTPS.

## 8. Local development
`node tools/serve.js 8080` serves the front-end without PHP (login falls back to built-in demo accounts, leads and audit stay in the browser). With PHP: `php -S localhost:8080` then open `/install.php`.

## Known limitations
See the final summary in the repository's latest commit message / README status section.
