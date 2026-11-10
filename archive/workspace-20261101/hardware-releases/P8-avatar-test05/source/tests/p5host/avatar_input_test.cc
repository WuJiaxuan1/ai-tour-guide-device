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

    std::puts("PASS: avatar04 single/double taps, drag/hold/swipe/error cancellation, state gating and clock wrap");
    constexpr float radians=0.01745329252f;
    const auto roll=[&](float degrees) {return AvatarImuSample{std::cos(degrees*radians),std::sin(degrees*radians),0,0,0,0};};
    const auto pitch=[&](float degrees) {return AvatarImuSample{std::cos(degrees*radians),0,std::sin(degrees*radians),0,0,0};};
    const auto near=[](float a,float b){return std::abs(a-b)<.0001f;};
    AvatarImuSample rest{1,0,0,0,0,0};
    AvatarTiltFilter filter;
    auto target=filter.Update(rest,100);
    assert(target.ready && target.x==0 && target.y==0); // first sample, no waiting
    // A tilted boot must NOT define the current angle as the center.
    AvatarTiltFilter tilted_boot;
    const auto right=roll(20);
    const auto held=tilted_boot.Update(right,100);
    assert(held.ready && held.x<-.75f && held.x>-.8f && held.y==0);
    for(uint32_t now=140;now<10100;now+=40) target=tilted_boot.Update(right,now);
    assert(near(target.x,held.x)); // ten seconds held, never recenters
    tilted_boot.Reset();
    target=tilted_boot.Update(right,10100);
    assert(near(target.x,held.x)); // page activation keeps same absolute target
    target=tilted_boot.Update(right,15100);
    assert(target.ready && near(target.x,held.x)); // outage: no relearn
    // Desk boot -> upright needs no stationary sampling or map round trip.
    AvatarTiltFilter desk;
    auto flat=pitch(90);target=desk.Update(flat,100);
    assert(target.ready && target.y==-1 && target.x==0);
    for(uint32_t now=140;now<=1100;now+=40) target=desk.Update(rest,now);
    assert(near(target.x,0) && near(target.y,0));
    // Both directions remain sensitive around vertical, including depth,
    // while a small natural hand tremor stays in the continuous dead zone.
    for(float angle:{-25.f,-20.f,-5.f,0.f,5.f,20.f,25.f}) {
        AvatarTiltFilter horizontal,vertical;
        auto x=horizontal.Update(roll(angle),100),y=vertical.Update(pitch(angle),100);
        assert(x.ready && y.ready && x.y==0 && y.x==0);
        assert(near(x.x,y.y));
        if(angle>0) assert(x.x<0); else if(angle<0) assert(x.x>0); else assert(x.x==0);
    }
    for(float angle:{-1.4f,1.4f}) {
        AvatarTiltFilter quiet;assert(quiet.Update(roll(angle),0).x==0);
    }
    AvatarTiltFilter edge;assert(std::abs(edge.Update(roll(1.51f),0).x)<.001f);
    // No discontinuity at flat, sideways, inverted or combined orientations.
    for(float a:{-1.f,0.f,1.f}) for(float b:{-1.f,0.f,1.f}) for(float c:{-1.f,0.f,1.f}) {
        const float norm=std::sqrt(a*a+b*b+c*c);if(norm==0) continue;
        AvatarTiltFilter bounded;
        auto value=bounded.Update({a/norm,b/norm,c/norm,0,0,0},100);
        assert(value.ready && std::isfinite(value.x) && std::isfinite(value.y));
        assert(std::abs(value.x)<=1 && std::abs(value.y)<=1);
    }
    // Angle output is independent of gravity magnitude and gyro spikes/NaNs.
    auto scaled=right;scaled.ax*=1.2f;scaled.ay*=1.2f;
    scaled.gx=2000;scaled.gy=std::numeric_limits<float>::quiet_NaN();
    AvatarTiltFilter scale;target=scale.Update(scaled,100);
    assert(near(target.x,held.x) && target.lead_x==0 && target.lead_y==0);
    auto nan=rest;nan.ax=std::numeric_limits<float>::quiet_NaN();
    auto jolt=rest;jolt.ax=2;
    assert(near(scale.Update(nan,140).x,held.x));
    assert(near(scale.Update(jolt,180).x,held.x));
    assert(!scale.Update(nan,2201).ready); // prolonged invalid stream becomes neutral
    assert(scale.Update(rest,2241).ready); // no new stationary calibration needed
    AvatarTiltFilter empty;assert(!empty.Update({0,0,0,0,0,0},100).ready);
    // Equivalent elapsed time at different sample intervals has equal smoothing.
    float response=0;
    for(uint32_t interval:{20u,40u,80u}) {
        AvatarTiltFilter timed;timed.Update(rest,800);
        for(uint32_t t=800+interval;t<=1040;t+=interval) target=timed.Update(roll(10),t);
        if(interval==20) response=target.x;else assert(near(target.x,response));
    }
    AvatarTiltFilter wrap;wrap.Update(rest,0xfffffff0);
    target=wrap.Update(right,24);assert(target.ready && target.x<0 && std::isfinite(target.x));
    // Mailbox consumes the latest valid gravity once; invalid samples cannot
    // keep stale data alive. Map-page data can be discarded on activation.
    AvatarMotionMailbox mailbox;AvatarImuSample sample{};uint32_t stamp=0;
    mailbox.Publish(true,rest,100);mailbox.Publish(true,right,120);
    assert(mailbox.Take(sample,stamp,140) && stamp==120 && sample.ay==right.ay);
    assert(!mailbox.Take(sample,stamp,160));
    mailbox.Publish(true,rest,200);assert(!mailbox.Take(sample,stamp,451));
    mailbox.Publish(true,rest,500);mailbox.Publish(false,right,510);
    mailbox.Publish(true,nan,515);mailbox.Publish(true,jolt,518);
    assert(mailbox.Take(sample,stamp,520) && stamp==500);
    mailbox.Publish(true,rest,600);mailbox.Clear();assert(!mailbox.Take(sample,stamp,620));
    mailbox.Publish(true,right,0xfffffff0);assert(mailbox.Take(sample,stamp,20));
    std::puts("PASS: avatar04 fixed vertical reference, tilted boot/page/outage invariance, desk pickup, signed depth/roll, held tilt, dead zone, gyro exclusion, invalid gravity and latest-sample mailbox");
}
