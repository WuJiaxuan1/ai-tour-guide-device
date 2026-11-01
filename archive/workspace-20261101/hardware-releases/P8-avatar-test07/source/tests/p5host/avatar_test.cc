#include "avatar_display.h"
#include "stopwatch_pages.h"
#include <cassert>
#include <cstdio>
#include <cstring>
#include <vector>
#include <algorithm>

static uint16_t framebuffer[466*466];
static uint16_t drawbuffer[466*20];
static void Advance(int milliseconds) {
    for(int t=0;t<milliseconds;t+=10) {lv_tick_inc(10);lv_timer_handler();}
}
static void Snapshot(const char* path) {
    FILE* file=std::fopen(path,"wb");assert(file);
    std::fprintf(file,"P6\n466 466\n255\n");
    for(auto pixel:framebuffer) {
        const unsigned char rgb[]={static_cast<unsigned char>(((pixel>>11)&31)*255/31),
            static_cast<unsigned char>(((pixel>>5)&63)*255/63),static_cast<unsigned char>((pixel&31)*255/31)};
        std::fwrite(rgb,1,3,file);
    }
    std::fclose(file);
}
int main() {
    // Guarded buffers catch drawing outside the screen. A forced full-clear
    // reference detects trails left by incremental dirty rectangles.
    constexpr size_t count=466*466;
    std::vector<uint16_t> guarded(count+128,0x1234),reference(count);
    auto* pixels=guarded.data()+64;
    AvatarSurface surface(pixels,466,466),full(reference.data(),466,466);
    AvatarEngine engine,expected;
    assert(engine.begin(&surface,10) && expected.begin(&full,10));
    uint32_t now=10;
    for(int id=0;id<static_cast<int>(ExpressionId::Count);++id) {
        engine.show(static_cast<ExpressionId>(id),now,false);
        expected.show(static_cast<ExpressionId>(id),now,false);
        // Stay before the first blink's random interval; test blink separately.
        for(int t=0;t<1000;t+=40,now+=40) {
            engine.update(now);expected.invalidate();expected.update(now);
            assert(std::equal(pixels,pixels+count,reference.data()));
            assert(std::all_of(guarded.begin(),guarded.begin()+64,[](auto v){return v==0x1234;}));
            assert(std::all_of(guarded.end()-64,guarded.end(),[](auto v){return v==0x1234;}));
        }
        assert(std::count(pixels,pixels+count,0xffff)>100);
    }
    engine.show(ExpressionId::Idle,now,false);
    for(int t=0;t<2500;t+=40,now+=40) engine.update(now);
    const auto open=std::count(pixels,pixels+count,0xffff);
    for(int t=0;t<220;t+=20,now+=20) engine.update(now);
    assert(std::count(pixels,pixels+count,0xffff)<open/2);
    for(int t=0;t<400;t+=20,now+=20) engine.update(now);
    assert(std::count(pixels,pixels+count,0xffff)>open/2);
    for(auto state:{ExpressionId::Idle,ExpressionId::Listening,ExpressionId::Thinking,ExpressionId::Speaking}) {
        engine.show(state,now,false);engine.react(ExpressionId::Happy,now);
        for(int t=0;t<3000;t+=40,now+=40) engine.update(now);
        assert(engine.activeExpression()==state);
    }
    // Tilt moves the same procedural eyes. Full redraw equivalence catches
    // trails at extreme head angles, eyelids and eyebrows, including edge clipping.
    AvatarEngine tilt_engine,tilt_reference;
    tilt_engine.begin(&surface,now);tilt_reference.begin(&full,now);
    tilt_engine.show(ExpressionId::Angry,now,false);tilt_reference.show(ExpressionId::Angry,now,false);
    for(int i=0;i<40;++i,now+=40) {
        const float direction=i<20?1.f:-1.f;
        tilt_engine.setTiltTarget(direction,.8f,.4f,.2f);
        tilt_reference.setTiltTarget(direction,.8f,.4f,.2f);
        tilt_engine.update(now);tilt_reference.invalidate();tilt_reference.update(now);
        assert(std::equal(pixels,pixels+count,reference.data()));
    }

    lv_init();auto display=lv_display_create(466,466);
    lv_display_set_color_format(display,LV_COLOR_FORMAT_RGB565);
    lv_display_set_buffers(display,drawbuffer,nullptr,sizeof(drawbuffer),LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(display,[](lv_display_t* d,const lv_area_t* a,uint8_t* data) {
        for(int y=a->y1;y<=a->y2;++y)
            std::memcpy(framebuffer+y*466+a->x1,data+(y-a->y1)*(a->x2-a->x1+1)*2,(a->x2-a->x1+1)*2);
        lv_display_flush_ready(d);
    });
    auto screen=lv_screen_active();
    auto original=lv_obj_create(screen);lv_obj_set_size(original,466,466);
    lv_obj_set_style_bg_color(original,lv_color_hex(0xFF0000),0);
    lv_obj_set_style_bg_opa(original,LV_OPA_COVER,0);
    auto status=lv_label_create(original);lv_label_set_text(status,"Network configuration");
    StopwatchPages pages;pages.Initialize(screen,466,466);
    AvatarDisplay avatar;assert(avatar.Initialize(pages.VoiceRoot(),466,466));
    Advance(100);assert(!avatar.Visible());
    assert(framebuffer[100*466+233]==0xF800);
    avatar.SetVisible(true);Advance(400);
    // Late status/subtitle updates cannot appear above the opaque image.
    lv_label_set_text(status,"Late notification");lv_obj_remove_flag(original,LV_OBJ_FLAG_HIDDEN);
    Advance(100);
    Snapshot("avatar-debug.ppm");
    for(int y=0;y<60;++y) for(int x=0;x<466;++x) assert(framebuffer[y*466+x]==0);
    for(int y=400;y<466;++y) for(int x=0;x<466;++x) assert(framebuffer[y*466+x]==0);
    assert(std::count(std::begin(framebuffer),std::end(framebuffer),0xFFFF)>500);
    Snapshot("avatar-idle.ppm");
    const struct {ExpressionId id;const char* path;} states[]={
        {ExpressionId::Listening,"avatar-listening.ppm"},{ExpressionId::Thinking,"avatar-thinking.ppm"},
        {ExpressionId::Speaking,"avatar-speaking.ppm"}};
    for(auto state:states) {
        avatar.SetBase(state.id);avatar.SetEmotion("neutral");Advance(800);
        assert(avatar.Active()==state.id);Snapshot(state.path);
    }
    avatar.SetEmotion("happy");Advance(600);Snapshot("avatar-happy.ppm");
    Advance(2500);assert(avatar.Active()==ExpressionId::Speaking);
    avatar.SetEmotion("thinking");Advance(11000);assert(avatar.Active()==ExpressionId::Speaking);
    avatar.SetEmotion("unknown");assert(avatar.Active()==ExpressionId::Speaking);
    avatar.SetVisible(false);Advance(100);assert(framebuffer[100*466+233]==0xF800);
    avatar.SetVisible(true);Advance(100);
    for(int i=0;i<20;++i) {
        avatar.SetPaused(true);pages.ShowMap(true);Advance(400);
        const std::vector<uint16_t> map(std::begin(framebuffer),std::end(framebuffer));
        avatar.SetEmotion("angry");Advance(1000);
        assert(std::equal(map.begin(),map.end(),framebuffer));
        avatar.SetPaused(false);pages.ShowMap(false);Advance(500);
        assert(std::count(std::begin(framebuffer),std::end(framebuffer),0xFFFF)>500);
    }
    avatar.SetBase(ExpressionId::Idle);
    auto touch=[&](bool pressed,bool valid=true,bool swipe=false) {
        avatar.Touch(valid,pressed,230,230,lv_tick_get(),swipe);
    };
    touch(false);touch(true);Advance(90);touch(false);Advance(320);touch(false);
    assert(avatar.Active()==ExpressionId::Surprised);
    Advance(2600);assert(avatar.Active()==ExpressionId::Idle);
    touch(true);Advance(90);touch(false);Advance(100);touch(true);Advance(90);touch(false);
    assert(avatar.Active()==ExpressionId::Happy);Advance(2400);
    touch(true);Advance(90);touch(false);avatar.SetBase(ExpressionId::Listening);
    Advance(400);touch(false);assert(avatar.Active()==ExpressionId::Listening);
    // Tilt changes pixels but never changes the underlying dialogue state.
    for(int i=0;i<25;++i) {avatar.Motion(true,{1,0,0,0,0,0},lv_tick_get());Advance(40);}
    const auto untilted=std::vector<uint16_t>(std::begin(framebuffer),std::end(framebuffer));
    for(int i=0;i<25;++i) {avatar.Motion(true,{.94f,.342f,0,0,0,0},lv_tick_get());Advance(40);}
    assert(avatar.Active()==ExpressionId::Listening);
    assert(!std::equal(untilted.begin(),untilted.end(),framebuffer));
    Snapshot("avatar-tilt.ppm");
    avatar.SetPaused(true);pages.ShowMap(true);Advance(350);
    const auto map_pixels=std::vector<uint16_t>(std::begin(framebuffer),std::end(framebuffer));
    for(int i=0;i<30;++i) {avatar.Motion(true,{.2f,-.3f,1,20,20,0},lv_tick_get());touch(i%2);Advance(40);}
    assert(std::equal(map_pixels.begin(),map_pixels.end(),framebuffer));
    avatar.SetPaused(false);pages.ShowMap(false);avatar.SetBase(ExpressionId::Idle);Advance(400);touch(false);
    assert(avatar.Active()==ExpressionId::Idle);
    // Acquisition runs at 50Hz independently of the 25Hz LVGL timer. A
    // completed gesture must appear once, return to idle, and yield to voice.
    auto rest=[&](int duration) {
        for(int t=0;t<duration;t+=20) {avatar.Motion(true,{1,0,0,0,0,0},lv_tick_get());Advance(20);}
    };
    auto shake=[&](int duration) {
        for(int t=0;t<duration;t+=20) {
            const float x=1.2f*std::sin(6.283185307f*3*t/1000.f);
            avatar.Motion(true,{1,x,0,0,0,0},lv_tick_get());Advance(20);
        }
    };
    rest(100);shake(800);assert(avatar.Active()==ExpressionId::Dizzy);
    Snapshot("avatar-shake-dizzy.ppm");
    rest(4000);assert(avatar.Active()==ExpressionId::Idle);
    shake(800);assert(avatar.Active()==ExpressionId::Dizzy);
    avatar.SetBase(ExpressionId::Listening);assert(avatar.Active()==ExpressionId::Listening);
    shake(1600);assert(avatar.Active()==ExpressionId::Listening);
    avatar.SetBase(ExpressionId::Idle);rest(100);shake(800);assert(avatar.Active()==ExpressionId::Dizzy);
    avatar.SetPaused(true);pages.ShowMap(true);Advance(400);
    const auto shake_map=std::vector<uint16_t>(std::begin(framebuffer),std::end(framebuffer));
    shake(1600);assert(std::equal(shake_map.begin(),shake_map.end(),framebuffer));
    avatar.SetPaused(false);pages.ShowMap(false);rest(600);assert(avatar.Active()==ExpressionId::Idle);
    // A cloud emotion and a pending tap are not allowed to be overwritten by
    // samples from a partially completed gesture.
    shake(240);avatar.SetEmotion("happy");shake(800);assert(avatar.Active()==ExpressionId::Happy);
    rest(3000);assert(avatar.Active()==ExpressionId::Idle);
    for(int t=0;t<1000;t+=20) {
        const float x=.45f*std::sin(6.283185307f*2*t/1000.f);
        avatar.Motion((t/20)%3!=2,{1,x,0,0,0,0},lv_tick_get());Advance(20);
    }
    assert(avatar.Active()==ExpressionId::Dizzy);
    rest(4000);assert(avatar.Active()==ExpressionId::Idle);
    std::puts("PASS: avatar06 actual LVGL moderate shake with missing sensor polls");
    // No map round trip and no perfectly still interval: repeated live
    // gestures must finish and rearm. Motion during playback cannot restart it.
    for(int round=0;round<5;++round) {
        shake(800);assert(avatar.Active()==ExpressionId::Dizzy);
        bool finished=false;
        for(int t=0;t<1500;t+=20) {
            const float x=.22f*((t/20)%2?1.f:-1.f);
            avatar.Motion((t/20)%3!=2,{1,x,0,0,0,0},lv_tick_get());Advance(20);
            if(avatar.Active()==ExpressionId::Idle) finished=true;
        }
        assert(finished && avatar.Active()==ExpressionId::Idle);
    }
    // Even continuous strong shaking must let a reaction complete before
    // collecting another full gesture; it must not hold Dizzy forever.
    int triggers=0,returns=0;auto previous=avatar.Active();
    for(int t=0;t<8000;t+=20) {
        const float x=1.2f*std::sin(6.283185307f*3*t/1000.f);
        avatar.Motion(true,{1,x,0,0,0,0},lv_tick_get());Advance(20);
        if(avatar.Active()==ExpressionId::Dizzy && previous!=ExpressionId::Dizzy) ++triggers;
        if(avatar.Active()==ExpressionId::Idle && previous==ExpressionId::Dizzy) ++returns;
        previous=avatar.Active();
    }
    assert(triggers>=3 && returns>=3 && triggers<=5);
    rest(2000);assert(avatar.Active()==ExpressionId::Idle);
    std::puts("PASS: avatar07 actual LVGL five rearm rounds, continuous-shake playback completion, single surprised and double happy");
    std::puts("PASS: avatar05 actual LVGL dizzy trigger/return, voice/cloud preemption and map-page cancellation");
    std::puts("PASS: avatar02 actual LVGL tap reactions, voice-state preemption, tilt rendering and map isolation");
    std::puts("PASS: avatar clipping, incremental/full render equivalence, blink, transient return, full-screen text occlusion, setup restore, neutral/base mapping, map pause and repeated page switching");
}
