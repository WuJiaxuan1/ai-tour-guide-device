# Avatar attribution

Derived from Trentct/m5stack-stopwatch-avatar, src/avatar_engine.h and src/avatar_engine.cpp.
Source: https://github.com/Trentct/m5stack-stopwatch-avatar
License: AGPL-3.0-or-later; full text in AVATAR-LICENSE.txt.

2026-10-31 initial port (avatar01): replaces Arduino/M5Unified display access with an RGB565 software surface and LVGL image; removes serial command parsing and hardware timers; adds a persistent Speaking expression. Original pose catalog, interpolation, gaze, blink and eye geometry retained. Target scheduling is 25 updates/second, not a measured frame rate. Complete modified module sources accompany the test package.

avatar02: connects BMI270 acceleration/gyro to tilt follow using the upstream screen-axis/sign mapping and gyro lead concept. Uses Espressif's existing bmi270_sensor component and shared IDF I2C bus, with a new stationary calibration/filter. Adds a new tap recognizer to the existing CST820 sampler (idle-only single happy/double surprised). Horizontal swipes and buttons continue to control pages. Touch dragging, shake reactions and vibration are not enabled.

avatar04: replaces learned neutral/gyro lead with fixed vertical gravity inclination, time-based smoothing and a dead zone. The user accepted this version on 2026-10-31; device timing has not been independently measured.

avatar05: adds an idle-only repeated horizontal shake gesture, inspired by the alternating-swing sequence in upstream src/main.cpp. A separate acquisition-side detector removes slow gravity changes, checks axis dominance, expires partial sequences, and requires cooldown/quiet rearming. The existing Dizzy expression plays once, yields to voice/cloud/page changes and returns to idle. The accepted avatar04 tilt algorithm is unchanged. No vibration, touch dragging or long-press gesture is enabled.

avatar06: tolerates brief not-ready reads instead of resetting the shake sequence on each missed poll; lowers shake strength/dominance thresholds and adds periodic acquisition/detection diagnostics. The defect and fix are reproduced using synthetic intermittent samples; real-device causality and gesture sensitivity remain pending user testing.

avatar07: removes the quiet-hold prerequisite that could indefinitely lock shake recognition. Recognition pauses during local Dizzy playback and rearms with a fresh sequence when it finishes; a bounded detector fallback prevents stale-event lockout. Idle tap mappings are swapped at the user's request: single Surprised, double Happy. The avatar04 tilt filter and renderer remain unchanged.

avatar08: adds short motor feedback for confirmed idle taps and the first Listening transition of a conversation. M5IOE1 PWM1/IO9 configuration and direct two-byte duty writes follow upstream src/main.cpp's vibration setup. A separate bounded worker handles pulse timing, cancellation and OFF retries; motor activity plus a settling interval suppresses IMU interactions. No playback-audio rhythm feature is included yet.

avatar11: improves sampling-phase tolerance for moderate/diagonal/faster shakes (0.28g lateral threshold, 0.85 axis ratio, 70ms reversal spacing; four alternating excursions retained). A displayed local Dizzy reaction requests one bounded Shake pulse using the existing worker and IMU suppression. Playback rearm, voice/map priority, fixed vertical tilt and wake-recovery logic are retained. Synthetic traces do not establish real-device gesture recognition rates.

avatar12: replaces the broad shake interaction with deliberate side-to-side translation while rejecting wrist rotation. Uses the existing BMI270 gyro to cancel gestures above 60deg/s or 18deg accumulated rotation, with 220ms settling; sustained alternating lateral acceleration lobes require 60ms and 0.04g*s evidence. Allows 140-1000ms lobe intervals and 3600ms total gesture duration. This is not a distance measurement. Tilt rendering remains gravity-only. Dizzy short haptics, wake recovery and navigation are retained.
