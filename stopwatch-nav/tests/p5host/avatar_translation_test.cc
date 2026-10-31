#include "avatar_shake.h"
#include <cstdio>
#include <cstring>
#include <limits>

constexpr float pi=3.14159265358979323846f;
int main(int argc,char** argv) {
    const bool check=argc>1 && std::strcmp(argv[1],"--check")==0;
    unsigned moves=0,move_ok=0,turns=0,turn_ok=0,other_fail=0;
    // Position traces x=A*sin(w*t) converted to physically consistent linear
    // acceleration, with constant gravity and small hand-orientation jitter.
    for(float distance:{.15f,.25f,.40f}) for(float hz:{1.2f,1.5f,2.f})
    for(int phase=0;phase<8;++phase) for(int polling=0;polling<3;++polling) {
        AvatarShakeTracker tracker;bool triggered=false;
        for(unsigned t=0,n=0;t<3000;t+=(polling==2?(n%2?32:48):20),++n) {
            const float angle=2*pi*(hz*t/1000.f+phase/8.f);
            const float a=-distance*.5f*std::pow(2*pi*hz,2)*std::sin(angle)/9.80665f;
            triggered|=tracker.Update(polling!=1 || n%3!=2,{1,a,.1f*a,0,8*std::sin(angle),0},t);
            if(triggered) break;
        }
        ++moves;if(triggered) ++move_ok;
    }
    // Wrist rotations: gravity rotates with the device; gyro is the analytic
    // angular derivative. Test all axes plus tangential acceleration at wrist.
    for(float degrees:{20.f,40.f,65.f}) for(float hz:{.4f,1.f,2.f,3.f})
    for(int axis=0;axis<3;++axis) for(int polling=0;polling<3;++polling) {
        AvatarShakeTracker tracker;bool triggered=false;
        for(unsigned t=0,n=0;t<5000;t+=(polling==2?(n%2?32:48):20),++n) {
            const float phase=2*pi*hz*t/1000.f;
            const float angle=degrees*pi/180*std::sin(phase),speed=degrees*2*pi*hz*std::cos(phase);
            AvatarImuSample s{1,0,0,0,0,0};
            if(axis==0) {s.ay=.9f*std::sin(phase);s.gx=speed;}
            if(axis==1) {s.ax=std::cos(angle);s.az=std::sin(angle);s.gy=speed;}
            if(axis==2) {s.ax=std::cos(angle);s.ay=std::sin(angle);s.gz=speed;}
            triggered|=tracker.Update(polling!=1 || n%3!=2,s,t);
        }
        ++turns;if(!triggered) ++turn_ok;
    }
    auto result=[&](bool ok,const char* name) {printf("%s: %s\n",ok?"PASS":"FAIL",name);if(!ok) ++other_fail;};
    // Accelerate, coast, decelerate: larger translations have weak/zero
    // acceleration between the ends. Do not require continuous shaking peaks.
    {
        AvatarShakeTracker tracker;bool fired=false;
        for(unsigned t=0;t<2600;t+=20) {
            const unsigned step=t%960;
            float a=step<100?1.1f:step<380?0:step<580?-1.1f:step<860?0:1.1f;
            fired|=tracker.Update(true,{1,a,0,0,0,0},t);
        }
        result(fired,"translation with coasting intervals triggers");
    }
    {
        AvatarShakeTracker tracker;bool fired=false;
        for(unsigned t=0;t<3000;t+=20) fired|=tracker.Update(true,{1,t==200?2.f:0.f,0,0,0,0},t);
        result(!fired,"isolated jolt does not trigger");
    }
    {
        AvatarShakeTracker tracker;bool fired=false;
        for(unsigned t=0;t<3000;t+=20) fired|=tracker.Update(true,{1,.35f*std::sin(2*pi*6*t/1000.f),0,0,0,0},t);
        result(!fired,"small fast jitter lacks sustained translation evidence");
    }
    {
        AvatarShakeTracker tracker;bool turning_fired=false,move_fired=false;
        for(unsigned t=0;t<1500;t+=20) turning_fired|=tracker.Update(true,{1,1.2f*std::sin(2*pi*2*t/1000.f),0,0,0,200},t);
        for(unsigned t=1500;t<2000;t+=20) tracker.Update(true,{1,0,0,0,0,0},t);
        for(unsigned t=2000;t<4000;t+=20) move_fired|=tracker.Update(true,{1,1.2f*std::sin(2*pi*2*t/1000.f),0,0,0,0},t);
        result(!turning_fired && move_fired,"rotation rejection recovers for fresh translation without page switch");
    }
    {
        AvatarShakeTracker tracker;bool fired=false;
        for(unsigned t=0;t<3000;t+=20) fired|=tracker.Update(true,{1,1.2f*std::sin(2*pi*2*t/1000.f),0,std::numeric_limits<float>::quiet_NaN(),0,0},t);
        result(!fired,"invalid gyro cannot authorize a translation gesture");
    }
    {
        AvatarShakeTracker tracker;bool fired=false;
        for(unsigned t=0;t<3000;t+=20) fired|=tracker.Update(true,{1,1.2f*std::sin(2*pi*2*t/1000.f),0,0,0,45},t);
        result(!fired,"accumulated orientation change rejects slower turning during motion");
    }
    #ifdef AVATAR_TRANSLATION_DIAGNOSTICS
    {
        AvatarShakeInput input;input.SetEnabled(true);
        for(unsigned t=0;t<2000;t+=20) input.Publish(true,{1,.9f*std::sin(2*pi*2*t/1000.f),0,0,0,200},t);
        AvatarShakeInput::Diagnostics d;
        result(!input.Take(2000) && input.ReadDiagnostics(2000,d) && d.rotation_rejects>0 && d.peak_gyro>=200,
            "diagnostics distinguish rotation rejection from missing IMU data");
    }
    #endif
    printf("TRANSLATION: %u/%u; ROTATION REJECTED: %u/%u\n",move_ok,moves,turn_ok,turns);
    if(check && (move_ok!=moves || turn_ok!=turns || other_fail)) return 1;
    if(check) puts("PASS: avatar12 translation trigger, wrist rejection and recovery");
}
