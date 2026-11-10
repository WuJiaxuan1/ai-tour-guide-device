// SPDX-License-Identifier: AGPL-3.0-or-later
#pragma once
#include "avatar_input.h"

// Inspired by the upstream alternating-horizontal-swing gesture. This detector
// runs on raw acquisition samples, separately from the accepted gravity gaze.
// Four alternating strong excursions, not a single jolt, produce one event.
class AvatarShakeTracker {
public:
    void Reset() {*this=AvatarShakeTracker();}
    static bool Valid(const AvatarImuSample& s) {
        const float norm2=s.ax*s.ax+s.ay*s.ay+s.az*s.az;
        return std::isfinite(norm2) && norm2>=.04f && norm2<=3.8f*3.8f;
    }
    unsigned Swings() const {return count_;}
    bool Cooling() const {return cooling_;}
    float Dx() const {return dx_;}
    float Dy() const {return dy_;}
    float Dz() const {return dz_;}
    bool Update(bool valid,const AvatarImuSample& s,uint32_t now) {
        // Read(false) also means 'no fresh accel sample yet', not necessarily
        // a failed sensor. Preserve progress across isolated missed polls.
        if(!valid) {
            if(have_ && now-last_>250) {have_=false;count_=0;}
            return false;
        }
        if(!Valid(s)) {
            have_=false;count_=0;return false;
        }
        if(!have_ || now-last_>250) {
            bx_=s.ay;by_=s.ax;bz_=s.az;last_=now;have_=true;
            dx_=dy_=dz_=0;
            count_=0;return false;
        }
        const uint32_t elapsed=now-last_;last_=now;
        if(elapsed==0) return false;
        const float dx=s.ay-bx_,dy=s.ax-by_,dz=s.az-bz_;
        dx_=dx;dy_=dy;dz_=dz;
        const float alpha=1.f-std::exp(-static_cast<float>(elapsed)/200.f);
        bx_+=dx*alpha;by_+=dy*alpha;bz_+=dz*alpha;
        if(cooling_) {
            // Bounded fallback when no display consumes the event. Normal
            // playback disables input, then rearms it at animation completion.
            // Neither route requires a quiet grip or a page transition.
            if(now-fired_>=1500) {cooling_=false;count_=0;}
            return false;
        }
        if(count_ && (now-started_>2200 || now-swing_>700)) count_=0;
        // Dominance rejects walking/up-down movement and desk pickup. Slow
        // tilts are absorbed into the baseline; no gyro signal is required.
        if(std::abs(dx)<.32f || std::abs(dx)<1.15f*std::max(std::abs(dy),std::abs(dz))) return false;
        const int direction=dx>0?1:-1;
        if(!count_) {count_=1;direction_=direction;started_=swing_=now;return false;}
        if(direction==direction_ || now-swing_<100) return false;
        direction_=direction;swing_=now;
        if(++count_<4) return false;
        count_=0;cooling_=true;fired_=now;return true;
    }
private:
    bool have_=false,cooling_=false;
    unsigned count_=0;
    int direction_=0;
    float bx_=0,by_=0,bz_=0;
    float dx_=0,dy_=0,dz_=0;
    uint32_t last_=0,started_=0,swing_=0,fired_=0;
};

// Acquisition owns no LVGL state. Display state gates the detector via a short
// mutex section; only a bounded, expiring event crosses to the render thread.
class AvatarShakeInput {
public:
    struct Diagnostics {
        bool enabled=false,cooling=false;
        uint32_t samples=0,missing=0,invalid=0,gate_changes=0,events=0,delivered=0,expired=0;
        uint32_t max_gap=0,max_swings=0;
        float peak_x=0,peak_y=0,peak_z=0;
    };
    void SetEnabled(bool enabled) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(enabled_==enabled) return;
        ++diagnostics_.gate_changes;
        enabled_=enabled;tracker_.Reset();pending_=false;
    }
    void Publish(bool valid,const AvatarImuSample& sample,uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!valid) ++diagnostics_.missing;
        else if(!AvatarShakeTracker::Valid(sample)) ++diagnostics_.invalid;
        else {
            ++diagnostics_.samples;
            if(have_good_) diagnostics_.max_gap=std::max(diagnostics_.max_gap,now-last_good_);
            last_good_=now;have_good_=true;
        }
        if(!enabled_) return;
        if(tracker_.Update(valid,sample,now)) {
            pending_=true;event_time_=now;++diagnostics_.events;
            diagnostics_.max_swings=4;
        }
        diagnostics_.max_swings=std::max<uint32_t>(diagnostics_.max_swings,tracker_.Swings());
        if(valid && AvatarShakeTracker::Valid(sample)) {
            diagnostics_.peak_x=std::max(diagnostics_.peak_x,std::abs(tracker_.Dx()));
            diagnostics_.peak_y=std::max(diagnostics_.peak_y,std::abs(tracker_.Dy()));
            diagnostics_.peak_z=std::max(diagnostics_.peak_z,std::abs(tracker_.Dz()));
        }
    }
    bool Take(uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!pending_) return false;
        pending_=false;
        if(!enabled_ || now-event_time_>250) {++diagnostics_.expired;return false;}
        ++diagnostics_.delivered;return true;
    }
    bool ReadDiagnostics(uint32_t now,Diagnostics& result) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(now-last_report_<2000) return false;
        last_report_=now;result=diagnostics_;
        result.enabled=enabled_;result.cooling=tracker_.Cooling();
        diagnostics_={};return true;
    }
private:
    std::mutex mutex_;
    AvatarShakeTracker tracker_;
    bool enabled_=false,pending_=false;
    uint32_t event_time_=0;
    Diagnostics diagnostics_;
    bool have_good_=false;
    uint32_t last_report_=0,last_good_=0;
};
