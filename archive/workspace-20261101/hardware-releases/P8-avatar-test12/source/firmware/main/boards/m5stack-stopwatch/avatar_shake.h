// SPDX-License-Identifier: AGPL-3.0-or-later
#pragma once
#include "avatar_input.h"

// Translate the device side to side while keeping its orientation steady.
// Acceleration lobes supply movement evidence; gyro rejects wrist rotation.
// This is a gesture classifier, not a distance or position measurement.
class AvatarShakeTracker {
public:
    void Reset() {*this=AvatarShakeTracker();}
    static bool Valid(const AvatarImuSample& s) {
        const float norm2=s.ax*s.ax+s.ay*s.ay+s.az*s.az;
        return std::isfinite(norm2) && norm2>=.04f && norm2<=3.8f*3.8f &&
            std::isfinite(s.gx) && std::isfinite(s.gy) && std::isfinite(s.gz);
    }
    unsigned Swings() const {return count_;}
    bool Cooling() const {return cooling_;}
    bool Turning() const {return rotation_blocked_;}
    bool RotationRejected() const {return rotation_rejected_;}
    float GyroSpeed() const {return gyro_;}
    float Dx() const {return dx_;}
    float Dy() const {return dy_;}
    float Dz() const {return dz_;}
    bool Update(bool valid,const AvatarImuSample& s,uint32_t now) {
        rotation_rejected_=false;
        if(!valid) {
            if(have_ && now-last_>250) {have_=false;ClearGesture();}
            return false;
        }
        if(!Valid(s)) {have_=false;ClearGesture();return false;}
        gyro_=std::hypot(std::hypot(s.gx,s.gy),s.gz);
        if(!have_ || now-last_>250) {
            bx_=s.ay;by_=s.ax;bz_=s.az;last_=now;have_=true;
            dx_=dy_=dz_=0;ClearGesture();
            if(gyro_>60.f) RejectRotation(now);
            return false;
        }
        const uint32_t elapsed=now-last_;last_=now;
        if(!elapsed) return false;
        dx_=s.ay-bx_;dy_=s.ax-by_;dz_=s.az-bz_;
        const float alpha=1.f-std::exp(-static_cast<float>(elapsed)/300.f);
        bx_+=dx_*alpha;by_+=dy_*alpha;bz_+=dz_*alpha;
        if(gyro_>60.f) RejectRotation(now);
        if(rotation_blocked_) {
            // Cover the quiet instant at a wrist reversal and the acceleration
            // filter's residual after turning. Do not collect partial swings.
            bx_=s.ay;by_=s.ax;bz_=s.az;ClearGesture();
            if(now-rotation_at_>=220) rotation_blocked_=false;
            return false;
        }
        if(cooling_) {
            if(now-fired_>=1500) {cooling_=false;ClearGesture();}
            return false;
        }
        if(count_ && (now-started_>3600 || now-swing_>1000)) ClearGesture();
        // Also reject slower but sustained turns that stay below the speed
        // limit. A small bias allowance tolerates gyro noise and grip tremor.
        if(count_ || lobe_direction_) {
            rotation_travel_+=std::max(0.f,gyro_-5.f)*std::min<uint32_t>(elapsed,100)/1000.f;
            if(rotation_travel_>18.f) {RejectRotation(now);return false;}
        }
        if(std::abs(dx_)<.28f || std::abs(dx_)<.9f*std::max(std::abs(dy_),std::abs(dz_))) {
            lobe_direction_=0;lobe_ms_=0;impulse_=0;return false;
        }
        const int direction=dx_>0?1:-1;
        if(direction!=lobe_direction_) {lobe_direction_=direction;lobe_ms_=0;impulse_=0;}
        // Require sustained motion, not one lucky peak. Cap credited time so
        // a missed poll cannot turn one sample into a large movement impulse.
        const uint32_t dt=std::min<uint32_t>(elapsed,60);
        lobe_ms_+=dt;impulse_+=std::abs(dx_)*dt/1000.f;
        if(lobe_ms_<60 || impulse_<.04f) return false;
        if(!count_) {count_=1;direction_=direction;started_=swing_=now;return false;}
        if(direction==direction_ || now-swing_<140) return false;
        direction_=direction;swing_=now;
        if(++count_<4) return false;
        ClearGesture();cooling_=true;fired_=now;return true;
    }
private:
    void ClearGesture() {count_=0;lobe_direction_=0;lobe_ms_=0;impulse_=0;rotation_travel_=0;}
    void RejectRotation(uint32_t now) {
        rotation_rejected_=true;rotation_blocked_=true;rotation_at_=now;ClearGesture();
    }
    bool have_=false,cooling_=false,rotation_blocked_=false,rotation_rejected_=false;
    unsigned count_=0;
    int direction_=0,lobe_direction_=0;
    float bx_=0,by_=0,bz_=0,dx_=0,dy_=0,dz_=0,gyro_=0,rotation_travel_=0,impulse_=0;
    uint32_t last_=0,started_=0,swing_=0,fired_=0,rotation_at_=0,lobe_ms_=0;
};

// Acquisition owns no LVGL state. Display state gates the detector via a short
// mutex section; only a bounded, expiring event crosses to the render thread.
class AvatarShakeInput {
public:
    struct Diagnostics {
        bool enabled=false,cooling=false,suppressed=false,turning=false;
        uint32_t samples=0,missing=0,invalid=0,gate_changes=0,events=0,delivered=0,expired=0;
        uint32_t max_gap=0,max_swings=0,rotation_rejects=0;
        float peak_x=0,peak_y=0,peak_z=0,peak_gyro=0;
    };
    void SetEnabled(bool enabled) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(enabled_==enabled) return;
        ++diagnostics_.gate_changes;
        enabled_=enabled;tracker_.Reset();pending_=false;
    }
    void SetSuppressed(bool suppressed) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(suppressed_==suppressed) return;
        suppressed_=suppressed;tracker_.Reset();pending_=false;
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
        if(!enabled_ || suppressed_) return;
        if(tracker_.Update(valid,sample,now)) {
            pending_=true;event_time_=now;++diagnostics_.events;
            diagnostics_.max_swings=4;
        }
        if(tracker_.RotationRejected()) ++diagnostics_.rotation_rejects;
        diagnostics_.peak_gyro=std::max(diagnostics_.peak_gyro,tracker_.GyroSpeed());
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
        if(!enabled_ || suppressed_ || now-event_time_>250) {++diagnostics_.expired;return false;}
        ++diagnostics_.delivered;return true;
    }
    bool ReadDiagnostics(uint32_t now,Diagnostics& result) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(now-last_report_<2000) return false;
        last_report_=now;result=diagnostics_;
        result.enabled=enabled_;result.cooling=tracker_.Cooling();
        result.suppressed=suppressed_;result.turning=tracker_.Turning();
        diagnostics_={};return true;
    }
private:
    std::mutex mutex_;
    AvatarShakeTracker tracker_;
    bool enabled_=false,pending_=false,suppressed_=false;
    uint32_t event_time_=0;
    Diagnostics diagnostics_;
    bool have_good_=false;
    uint32_t last_report_=0,last_good_=0;
};
