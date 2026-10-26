# SENTRA — computer-vision demo platform

Sales-demo control room for cafés, restaurants and hospitals. Full brief: [docs/PLAN.md](docs/PLAN.md).

## Status
Built: design system, EN/AR (RTL) shell, simulation engine, login, overview, live wall, alerts, analytics, playback + batch-job simulation, reports (PDF/CSV), cameras and zone/line editor, settings, RBAC, PHP API + installer, bake tool, docs.
Not built yet: in-browser live inference (stretch), polygon zones (rectangles + tripwire lines only), full QA across all screens/sizes. Baked-track replay is wired but untested with real YOLO output.

Deploy: [README_DEPLOY.md](README_DEPLOY.md) · Sales script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)

## Run locally (no PHP needed for the front-end)
    node tools/serve.js 8080

Arabic (RTL) is the default language for new visitors; English is one click away (top bar). Dates are Gregorian with Latin digits, plus a Hijri date in the Arabic top bar; the clock is 12-hour with ص/م.

Demo logins (password `Sentra#2026`): admin@demo.local, manager@demo.local, viewer@demo.local
