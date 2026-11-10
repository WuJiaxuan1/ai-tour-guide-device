#include "avatar_shake.h"
#include <cassert>
#include <cstdio>
#include <limits>

static AvatarImuSample Shake(uint32_t t,int axis=1,float amplitude=1.2f) {
    const float wave=amplitude*std::sin(6.283185307f*3*t/1000.f);
    AvatarImuSample s{1,0,0,0,0,0};
    if(axis==0) s.ax+=wave;else if(axis==1) s.ay=wave;else s.az=wave;
    return s;
}
int main() {
    AvatarShakeTracker detector;int events=0;uint32_t first_event=0;
    for(uint32_t t=0;t<5000;t+=20) if(detector.Update(true,Shake(t),t)) {if(!events) first_event=t;++events;}
    assert(events==1); // continuous shaking cannot loop the reaction
    for(uint32_t t=5000;t<6500;t+=20) assert(!detector.Update(true,{1,0,0,0,0,0},t));
    for(uint32_t t=6500;t<7800;t+=20) events+=detector.Update(true,Shake(t-6500),t);
    assert(events==2); // quiet interval permits a fresh deliberate gesture
    // Up/down, depth and weak walking-like motion do not count as horizontal.
    for(int axis:{0,1,2}) {
        AvatarShakeTracker other;
        for(uint32_t t=0;t<5000;t+=20) assert(!other.Update(true,Shake(t,axis,axis==1?.2f:1.2f),t));
    }
    // Desk pickup, slow back-and-forth inclination and a single hard jolt.
    AvatarShakeTracker normal;
    for(uint32_t t=0;t<5000;t+=20) {
        const float angle=.44f*std::sin(6.283185307f*t/2500.f);
        assert(!normal.Update(true,{std::cos(angle),std::sin(angle),0,0,0,0},t));
    }
    for(uint32_t t=5000;t<6000;t+=20) {
        const float a=1.570796327f*(t-5000)/1000.f;
        assert(!normal.Update(true,{std::cos(a),0,std::sin(a),0,0,0},t));
    }
    for(uint32_t t=6000;t<6500;t+=20) assert(!normal.Update(true,{1,t==6040?2.f:0.f,0,0,0,0},t));
    // Invalid reads, gaps and disabling discard partial sequences, not merely
    // their last sample. Two swings before + two after cannot combine.
    for(int mode=0;mode<3;++mode) {
        AvatarShakeTracker partial;
        partial.Update(true,{1,0,0,0,0,0},0);
        for(uint32_t t=20;t<=300;t+=20) assert(!partial.Update(true,Shake(t),t));
        if(mode==0) partial.Update(false,{},320);
        if(mode==1) partial.Reset();
        if(mode==2) partial.Update(true,{1,0,0,0,0,0},600);
        const uint32_t start=mode==2?620:340;
        for(uint32_t t=0;t<300;t+=20) assert(!partial.Update(true,Shake(t),start+t));
    }
    // Sparse impulses separated by >500ms cannot accumulate forever.
    AvatarShakeTracker sparse;
    for(uint32_t t=0;t<5000;t+=20) {
        const float x=t%800==100?(t/800%2?1.2f:-1.2f):0;
        assert(!sparse.Update(true,{1,x,0,0,0,0},t));
    }
    AvatarShakeTracker wrapped;events=0;
    for(uint32_t t=0;t<1300;t+=20) events+=wrapped.Update(true,Shake(t),0xffffff00u+t);
    assert(events==1);
    AvatarShakeTracker invalid;
    assert(!invalid.Update(true,{1,std::numeric_limits<float>::quiet_NaN(),0,0,0,0},0));
    assert(!invalid.Update(true,{4,4,4,0,0,0},20));
    assert(!invalid.Update(true,{0,0,0,0,0,0},40));
    // A completed event expires, can be taken once, and is discarded when a
    // conversation/page transition disables acquisition before the next frame.
    for(int mode=0;mode<4;++mode) {
        AvatarShakeInput input;input.SetEnabled(true);
        for(uint32_t t=0;t<=first_event;t+=20) input.Publish(true,Shake(t),t);
        if(mode==0) {assert(input.Take(first_event+20));assert(!input.Take(first_event+20));}
        if(mode==1) {input.SetEnabled(false);assert(!input.Take(first_event+20));input.SetEnabled(true);assert(!input.Take(first_event+20));}
        if(mode==2) assert(!input.Take(2000));
        if(mode==3) {input.SetEnabled(false);for(uint32_t t=800;t<2000;t+=20) input.Publish(true,Shake(t),t);assert(!input.Take(2000));}
    }
    std::puts("PASS: avatar05 repeated horizontal shake, cooldown/quiet rearm, tilt/pickup/jolt/walk/other-axis rejection, gap/error cancellation, clock wrap and event isolation");
}
