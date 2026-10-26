# Arabic QA log

Checked in the browser pane: dark + light, 1440 / 768 / 375 px, all nine screens, Arabic default.

Automated sweeps (per screen/size/theme): horizontal overflow, clipped text, tap targets (>=44px on touch widths), WCAG text contrast (4.5:1 / 3:1 large), leftover Latin text in Arabic mode.

Fixed: Arabic glyphs in the monospace stack (added Plex Arabic fallback), canvas label bidi, charts rendered at real width (no stretched SVG text), time charts kept left-to-right with Arabic labels, bottom-nav short labels, touch targets, light-theme plot colour, file input localised, "التشغيل" ambiguity (playback is now "المقاطع المسجّلة"), "bar" -> "ركن المشروبات".

Not covered: review by a native Saudi copy editor; real screen-reader testing (VoiceOver/NVDA) in Arabic; print/PDF output in Arabic; baked-footage tiles in Arabic.
