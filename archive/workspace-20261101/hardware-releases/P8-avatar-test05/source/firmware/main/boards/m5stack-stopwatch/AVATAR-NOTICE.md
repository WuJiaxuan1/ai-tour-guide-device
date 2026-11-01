# Avatar attribution

Derived from Trentct/m5stack-stopwatch-avatar, src/avatar_engine.h and src/avatar_engine.cpp.
Source: https://github.com/Trentct/m5stack-stopwatch-avatar
License: AGPL-3.0-or-later; full text in AVATAR-LICENSE.txt.

2026-10-31 initial port (avatar01): replaces Arduino/M5Unified display access with an RGB565 software surface and LVGL image; removes serial command parsing and hardware timers; adds a persistent Speaking expression. Original pose catalog, interpolation, gaze, blink and eye geometry retained. Target scheduling is 25 updates/second, not a measured frame rate. Complete modified module sources accompany the test package.

avatar02: connects BMI270 acceleration/gyro to tilt follow using the upstream screen-axis/sign mapping and gyro lead concept. Uses Espressif's existing bmi270_sensor component and shared IDF I2C bus, with a new stationary calibration/filter. Adds a new tap recognizer to the existing CST820 sampler (idle-only single happy/double surprised). Horizontal swipes and buttons continue to control pages. Touch dragging, shake reactions and vibration are not enabled.

avatar04: replaces learned neutral/gyro lead with fixed vertical gravity inclination, time-based smoothing and a dead zone. The user accepted this version on 2026-10-31; device timing has not been independently measured.

avatar05: adds an idle-only repeated horizontal shake gesture, inspired by the alternating-swing sequence in upstream src/main.cpp. A separate acquisition-side detector removes slow gravity changes, checks axis dominance, expires partial sequences, and requires cooldown/quiet rearming. The existing Dizzy expression plays once, yields to voice/cloud/page changes and returns to idle. The accepted avatar04 tilt algorithm is unchanged. No vibration, touch dragging or long-press gesture is enabled.
