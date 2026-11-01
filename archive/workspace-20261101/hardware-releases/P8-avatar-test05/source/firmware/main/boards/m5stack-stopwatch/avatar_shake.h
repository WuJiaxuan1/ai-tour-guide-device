// SPDX-License-Identifier: AGPL-3.0-or-later
#pragma once
#include "avatar_input.h"

// Inspired by the upstream alternating-horizontal-swing gesture. This detector
// runs on raw acquisition samples, separately from the accepted gravity gaze.
// Four alternating strong excursions, not a single jolt, produce one event.
class AvatarShakeTracker {
public:
    void Reset() {*this=AvatarShakeTracker();}
    bool Update(bool valid,const AvatarImuSample& s,uint32_t now) {
        const float norm2=s.ax*s.ax+s.ay*s.ay+s.az*s.az;
        if(!valid || !std::isfinite(norm2) || norm2<.04f || norm2>3.8f*3.8f) {
            have_=false;count_=0;quiet_=false;return false;
        }
        if(!have_ || now-last_>120) {
            bx_=s.ay;by_=s.ax;bz_=s.az;last_=now;have_=true;
            count_=0;quiet_=false;return false;
        }
        const uint32_t elapsed=now-last_;last_=now;
        if(elapsed==0) return false;
        const float dx=s.ay-bx_,dy=s.ax-by_,dz=s.az-bz_;
        const float alpha=1.f-std::exp(-static_cast<float>(elapsed)/200.f);
        bx_+=dx*alpha;by_+=dy*alpha;bz_+=dz*alpha;
        const float energy=std::max({std::abs(dx),std::abs(dy),std::abs(dz)});
        if(cooling_) {
            if(energy<.18f) {
                if(!quiet_) {quiet_=true;quiet_since_=now;}
                if(now-fired_>=3000 && now-quiet_since_>=650) cooling_=false;
            } else quiet_=false;
            return false;
        }
        if(count_ && (now-started_>1600 || now-swing_>500)) count_=0;
        // Dominance rejects walking/up-down movement and desk pickup. Slow
        // tilts are absorbed into the baseline; no gyro signal is required.
        if(std::abs(dx)<.55f || std::abs(dx)<1.5f*std::max(std::abs(dy),std::abs(dz))) return false;
        const int direction=dx>0?1:-1;
        if(!count_) {count_=1;direction_=direction;started_=swing_=now;return false;}
        if(direction==direction_ || now-swing_<100) return false;
        direction_=direction;swing_=now;
        if(++count_<4) return false;
        count_=0;cooling_=true;quiet_=false;fired_=now;return true;
    }
private:
    bool have_=false,cooling_=false,quiet_=false;
    unsigned count_=0;
    int direction_=0;
    float bx_=0,by_=0,bz_=0;
    uint32_t last_=0,started_=0,swing_=0,fired_=0,quiet_since_=0;
};

// Acquisition owns no LVGL state. Display state gates the detector via a short
// mutex section; only a bounded, expiring event crosses to the render thread.
class AvatarShakeInput {
public:
    void SetEnabled(bool enabled) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(enabled_==enabled) return;
        enabled_=enabled;tracker_.Reset();pending_=false;
    }
    void Publish(bool valid,const AvatarImuSample& sample,uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(enabled_ && tracker_.Update(valid,sample,now)) {pending_=true;event_time_=now;}
    }
    bool Take(uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!pending_) return false;
        pending_=false;return enabled_ && now-event_time_<=250;
    }
private:
    std::mutex mutex_;
    AvatarShakeTracker tracker_;
    bool enabled_=false,pending_=false;
    uint32_t event_time_=0;
};
