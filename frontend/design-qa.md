# Design QA — Qixia mobile adaptation

Date: 2026-10-29. Scope: an original mobile-friendly frontend using the selected OpenUI Trip Planner visual direction. This is not a pixel-identical clone or a verified live-agent deployment.

## Evidence

- Source URL: https://www.openui.com/demo/trip-planner/planner . Browser source captured on desktop 1280×720 and mobile 390×844; source mobile image saved in `qa/reference-mobile.png`.
- Initial comparison: `qa/mobile-comparison.png`. Final same-size combined comparison: `qa/mobile-comparison-final.png`. Both image panels are 390×844 screenshot pixels for a 390×844 CSS viewport, with no device-frame crop.
- Final implementation: `qa/implementation-mobile-final.png`, `qa/implementation-desktop.png`; additional route state in `qa/route-mobile.png`.
- Browser checks: widths 360, 390, 414 and 1280; no document horizontal overflow found. Screenshots, accessible DOM and local browser console inspected.

## Iteration 1 findings and fixes

- P2, typography: Chinese suggestion text was 12px and harder to scan than the source's larger card labels. Changed mobile suggestions to 14px, minimum height82px, and flexible text width. Final comparison confirms readable two-line labels without collisions.
- P2, color: muted introductory copy was too light. Darkened body/eyebrow/mode-caption tokens while retaining the reference's white background and quiet palette. Final comparison inspected after the change.

## Final review

- Fonts/typography: preserved serif display headline and intro, sans-serif controls. Chinese Songti/SimSun replaces source's Latin display font intentionally. Two-line Chinese headline is intentional localization. System fonts are local; no remote font request required.
- Spacing/layout: retained airy hero, 2×2 mobile suggestions, floating rounded composer, restrained shadows and rounded surfaces. Persistent three-tab mobile navigation is an intentional improvement over the source mobile view where tabs were not shown. Desktop becomes a four-column suggestion row.
- Colors: white and warm neutrals with soft pink send button; explicit disabled state; green route actions. Browser focus indicators present. Contrast corrections applied above.
- Images: reference mascot and proprietary 3D illustrations were intentionally replaced with the project's supplied mascot and real scenic photos. This is an original Qixia content adaptation, not source-asset reproduction. Image loading checked; no broken images found. Standard Lucide icons used consistently; no hand-drawn replacement graphics.
- Content: Qixia text is derived from organizer documents. Local scenario responses explicitly say demo. Real-time prices/weather/accessibility, precise locations and route travel times are not invented.
- Interactions verified: preset question → demo response → detail → save → add to route; saved filter; second stop add; reorder/remove/clear; map zoom and full-map dialog; history restore; free-text question; current-information refusal; new conversation; disabled empty send state. Live failure and reply schema are tested with injected HTTP responses, not claimed as real backend connectivity.
- Accessibility: named buttons, image alt text, semantic dialogs, initial dialog focus, Tab focus loop, Escape close and reduced-motion support. Actual smartphone keyboard and device-specific audio availability remain physical-device checks.
- Browser console: no warning/error entries in the tested local flow.

## Remaining limitations

- Team agent backend not supplied. Current experience is explicitly preset demo content plus an adapter, not a functioning autonomous agent.
- Static organizer map, no GPS/route engine; foreground illustrations and mascot can be refined later once brand assets are approved.
- Browser read-aloud varies by installed voices; audible output not verified on physical iOS/Android devices.
- Public deployment, real device testing, and model/knowledge-base integration not performed.

No remaining P0/P1/P2 findings within the stated frontend-preview scope. Physical-device checks and brand-asset polish are follow-up work.

final result: passed
