# Avatar attribution

Derived from Trentct/m5stack-stopwatch-avatar, src/avatar_engine.h and src/avatar_engine.cpp.
Source: https://github.com/Trentct/m5stack-stopwatch-avatar
License: AGPL-3.0-or-later; full text in AVATAR-LICENSE.txt.

2026-10-31 port: replaces Arduino/M5Unified display access with an RGB565 software surface and LVGL image; removes serial command parsing and hardware timers; adds a persistent Speaking expression. Original pose catalog, interpolation, gaze, blink and eye geometry retained. Hardware touch/IMU inputs are not connected; existing navigation gestures retain control. Target scheduling is 25 updates/second, not a measured frame rate. Complete modified module sources accompany the test package.
