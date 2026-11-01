from pathlib import Path
import re, shutil
src=Path('.local-work/stopwatch-avatar')
dst=Path('stopwatch-nav/firmware/main/boards/m5stack-stopwatch')
h=(src/'src/avatar_engine.h').read_text('utf-8')
c=(src/'src/avatar_engine.cpp').read_text('utf-8')
h=h.replace('#include <M5Unified.h>','#include <cstdint>\n#include "avatar_surface.h"')
h=h.replace('bool begin();','bool begin(AvatarSurface* surface, uint32_t nowMs);')
h=h.replace('  bool showFromCommand(const String& command, uint32_t nowMs);\n','')
h=h.replace(' private:\n',' private:\n  AvatarSurface* surface_ = nullptr;\n',1)
h=re.sub(r'  void recordRenderMetrics\([^;]+;\n','',h)
c=c.replace('#include "avatar_engine.h"','#include "avatar_engine.h"\n#include <cstdlib>')
c=c.replace('constexpr uint32_t kFrameIntervalUs = 16667;\n','').replace('constexpr uint32_t kMetricsReportIntervalMs = 5000;\n','')
c=c.replace('TFT_BLACK','0x0000').replace('TFT_WHITE','0xFFFF').replace('M5.Display.','surface_->')
c=c.replace('bool AvatarEngine::begin() {','bool AvatarEngine::begin(AvatarSurface* surface, uint32_t nowMs) {\n  surface_ = surface;')
c=c.replace('ready_ = surface_->width() > 0', 'ready_ = surface_ && surface_->width() > 0')
c=c.replace('  const uint32_t nowMs = millis();\n','')
c=re.sub(r'  Serial.printf\("Avatar renderer:.*?;\n','',c,flags=re.S)
c=re.sub(r'    Serial.printf\("Return to base:.*?;\n','',c)
a=c.index('bool AvatarEngine::showFromCommand('); b=c.index('void AvatarEngine::setTouchTarget(',a);c=c[:a]+c[b:]
c=c.replace('random(0, blink.maxIntervalMs - blink.minIntervalMs + 1)','(std::rand() % (blink.maxIntervalMs - blink.minIntervalMs + 1))')
c=c.replace('  const uint32_t renderStartedUs = micros();\n','')
c=c.replace('  recordRenderMetrics(nowMs, renderStartedUs, micros());\n','')
a=c.index('void AvatarEngine::recordRenderMetrics('); b=c.index('void AvatarEngine::update(',a);c=c[:a]+c[b:]
a=c.index('  const uint32_t nowUs = micros();');c=c[:a]+'  forceRender_ = false;\n  render(nowMs);\n}\n'
h=h.replace('  Count,','  Speaking,\n  Count,')
insert='''const AvatarEngine::Keyframe kSpeakingFrames[] = {
    {makePose(makeEye(-220, -18, 178, 320), makeEye(220, -18, 178, 320), 1.01f, 0, -10, 5, -2, 2),
     240, 160, AvatarEngine::Easing::Smooth},
    {makePose(makeEye(-220, -10, 165, 285), makeEye(220, -10, 190, 310), 1.0f, 0, -4, -5, 2, -2),
     280, 180, AvatarEngine::Easing::Smooth},
};

'''
c=c.replace('const AvatarEngine::ExpressionSpec kExpressions[] = {',insert+'const AvatarEngine::ExpressionSpec kExpressions[] = {')
end=c.index('\n};',c.index('const AvatarEngine::ExpressionSpec kExpressions[]'))
c=c[:end]+ '\n    {"SPEAKING", kSpeakingFrames, 2, AvatarEngine::PlaybackMode::Loop,\n     kAttentiveBlink, kListeningMotion, true},'+c[end:]
for name,data in [('avatar_engine.h',h),('avatar_engine.cc',c)]:
    (dst/name).write_text(data,encoding='utf-8')
shutil.copyfile(src/'LICENSE',dst/'AVATAR-LICENSE.txt')
(dst/'AVATAR-NOTICE.md').write_text('''# Avatar attribution

Derived from Trentct/m5stack-stopwatch-avatar, src/avatar_engine.h and src/avatar_engine.cpp.
Source: https://github.com/Trentct/m5stack-stopwatch-avatar
License: AGPL-3.0-or-later; full text in AVATAR-LICENSE.txt.

2026-10-31 port: replaces Arduino/M5Unified display access with an RGB565 software surface and LVGL image; removes serial command parsing and hardware timers; adds a persistent Speaking expression. Original pose catalog, interpolation, gaze, blink and eye geometry retained. Hardware touch/IMU inputs are not connected; existing navigation gestures retain control. Target scheduling is 25 updates/second, not a measured frame rate. Complete modified module sources accompany the test package.
''',encoding='utf-8')
