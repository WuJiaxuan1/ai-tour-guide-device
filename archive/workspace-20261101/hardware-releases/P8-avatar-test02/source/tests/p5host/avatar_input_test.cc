#include "avatar_input.h"
#include <cassert>
#include <cstdio>
#include <limits>

int main() {
    using Event=AvatarTapTracker::Event;
    AvatarTapTracker taps;
    auto step=[&](bool pressed,uint32_t now,int x=220,int y=220,bool valid=true,bool enabled=true,bool swipe=false) {
        return taps.Update(enabled,valid,pressed,x,y,now,swipe);
    };
    step(false,0);step(true,10);assert(step(false,100)==Event::None);
    assert(step(false,400)==Event::None);assert(step(false,401)==Event::Single);
    assert(step(false,500)==Event::None);
    step(true,600);step(false,690);step(true,800);
    assert(step(false,890)==Event::Double);assert(step(false,1250)==Event::None);
    // Swipes, small drags, vertical drags, holds and read failures never tap.
    for(int mode=0;mode<5;++mode) {
        const uint32_t t=2000+mode*2000;
        taps.Cancel();step(false,t);step(true,t+10);
        if(mode==0) step(true,t+80,310,220,true,true,true);
        if(mode==1) {step(true,t+80,245);step(true,t+120,220);}
        if(mode==2) step(true,t+80,220,290);
        if(mode==3) step(true,t+400);
        if(mode==4) step(true,t+80,220,220,false);
        assert(step(false,t+500)==Event::None);
        assert(step(false,t+900)==Event::None);
    }
    // A pending single must disappear when conversation/page/configuration changes.
    step(true,13000);step(false,13080);step(false,13100,220,220,true,false);
    assert(step(false,13500)==Event::None);assert(step(false,13900)==Event::None);
    // Held contact during a state change cannot become a fresh click on return.
    step(true,14000);taps.Cancel();step(true,14050);step(false,14120);
    assert(step(false,14600)==Event::None);
    // A second contact that becomes a swipe cancels both tap candidates.
    step(true,15000);step(false,15090);step(true,15200);
    step(true,15260,310,220,true,true,true);step(false,15300);
    assert(step(false,15700)==Event::None);
    // A contact below the sampling tolerance is rejected, and millis wrap is safe.
    step(true,16000);step(false,16010);assert(step(false,16400)==Event::None);
    taps.Cancel();step(false,0xfffffff0);step(true,0xfffffff8);step(false,64);
    assert(step(false,365)==Event::Single);

    AvatarTiltFilter filter;
    AvatarTilt target;
    AvatarImuSample rest{0,0,1,0.8f,-0.5f,0};
    uint32_t now=100;
    for(int i=0;i<19;++i,now+=40) {target=filter.Update(rest,now);assert(!target.ready);}
    target=filter.Update(rest,now);now+=40;
    assert(target.ready && target.x==0 && target.y==0 && std::abs(target.lead_x)<0.00001f);
    auto right=rest;right.ay=0.28f;
    for(int i=0;i<30;++i,now+=40) target=filter.Update(right,now);
    assert(target.x<-.98f && target.y==0); // raw Y -> screen X, upstream negative sign
    auto vertical=rest;vertical.ax=-0.28f;
    for(int i=0;i<40;++i,now+=40) target=filter.Update(vertical,now);
    assert(target.y>.98f && std::abs(target.x)<0.01f);
    auto turning=vertical;turning.gx=90.8f;turning.gy=89.5f;
    target=filter.Update(turning,now);now+=40;
    assert(std::abs(target.lead_x+.5f)<0.0001f && std::abs(target.lead_y-.5f)<0.0001f);
    auto extreme=rest;extreme.ay=-0.8f;
    for(int i=0;i<30;++i,now+=40) target=filter.Update(extreme,now);
    assert(target.x==1);
    for(int i=0;i<60;++i,now+=40) target=filter.Update(rest,now);
    assert(target.ready && target.x==0 && target.y==0);
    // A gap or invalid sample cannot leave a stale gaze indefinitely.
    target=filter.Update(rest,now+1000);assert(!target.ready);now+=1040;
    auto nan=rest;nan.ax=std::numeric_limits<float>::quiet_NaN();
    assert(!filter.Update(nan,now).ready);now+=40;
    filter.Reset();
    for(int i=0;i<50;++i,now+=40) {
        auto moving=rest;moving.gx=40;
        assert(!filter.Update(moving,now).ready);
    }
    for(int i=0;i<20;++i,now+=40) target=filter.Update(rest,now);
    assert(target.ready);
    filter.Reset();
    auto tilted=rest;tilted.ax=.3f;tilted.ay=-.2f;tilted.az=.9f;
    for(int i=0;i<20;++i,now+=40) target=filter.Update(tilted,now);
    assert(target.ready && target.x==0 && target.y==0); // calibrate in a user's actual grip
    std::puts("PASS: avatar02 single/double discrimination, drag/hold/swipe/error cancellation, state gating, clock wrap, stationary calibration, axis/sign mapping, gyro bias/lead, clamping and stale recovery");
}
