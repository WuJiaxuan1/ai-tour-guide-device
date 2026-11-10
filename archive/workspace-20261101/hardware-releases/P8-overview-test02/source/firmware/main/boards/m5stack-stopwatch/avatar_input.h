#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <mutex>

// Screen taps use the existing touch sampler, never a second touch driver.
// A release is required after cancellation so a held finger cannot become a tap.
class AvatarTapTracker {
public:
    enum class Event { None, Single, Double };
    void Cancel() { down_=pending_=second_=false; blocked_=true; }
    Event Update(bool enabled,bool valid,bool pressed,int x,int y,uint32_t now,bool swipe=false) {
        if(!enabled || !valid || swipe) {Cancel();return Event::None;}
        if(blocked_) {if(!pressed) blocked_=false;return Event::None;}
        if(pressed) {
            if(!down_) {
                down_=true;start_=now;x_=x;y_=y;
                second_=pending_ && now-released_<=300 && Distance(x,y,last_x_,last_y_)<=40*40;
            }
            if(now-start_>300 || Distance(x,y,x_,y_)>18*18) {Cancel();}
            return Event::None;
        }
        if(down_) {
            down_=false;
            if(now-start_<30 || now-start_>300) {Cancel();blocked_=false;return Event::None;}
            if(second_) {pending_=second_=false;return Event::Double;}
            // A separate quick tap becomes a fresh candidate, never a surprise
            // after a drag; movement cancels both candidates above.
            pending_=true;released_=now;last_x_=x_;last_y_=y_;
        }
        if(pending_ && now-released_>300) {pending_=false;return Event::Single;}
        return Event::None;
    }
private:
    static int Distance(int x,int y,int a,int b) {return (x-a)*(x-a)+(y-b)*(y-b);}
    bool down_=false,pending_=false,second_=false,blocked_=true;
    int x_=0,y_=0,last_x_=0,last_y_=0;
    uint32_t start_=0,released_=0;
};

struct AvatarImuSample {float ax,ay,az,gx,gy,gz;}; // g and degrees/second, BMI270 axes
struct AvatarTilt {float x=0,y=0,lead_x=0,lead_y=0;bool ready=false;};

// Gyro is deliberately excluded: avatar04 uses gravity only. Invalid accel
// must not refresh the last-good timestamp, even if the I2C read succeeded.
inline bool AvatarGravityValid(const AvatarImuSample& sample) {
    if(!std::isfinite(sample.ax) || !std::isfinite(sample.ay) || !std::isfinite(sample.az)) return false;
    const float norm2=sample.ax*sample.ax+sample.ay*sample.ay+sample.az*sample.az;
    return norm2>=0.6f*0.6f && norm2<=1.5f*1.5f;
}

// Single latest-sample slot: the IMU never waits for LVGL drawing. Consumers
// discard old data instead of replaying a backlog after a busy frame/page change.
class AvatarMotionMailbox {
public:
    void Publish(bool valid,const AvatarImuSample& sample,uint32_t now) {
        if(!valid || !AvatarGravityValid(sample)) return;
        std::lock_guard<std::mutex> lock(mutex_);
        sample_=sample;time_=now;pending_=true;
    }
    bool Take(AvatarImuSample& sample,uint32_t& time,uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!pending_) return false;
        pending_=false;
        if(now-time_>250) return false;
        sample=sample_;time=time_;return true;
    }
    void Clear() {std::lock_guard<std::mutex> lock(mutex_);pending_=false;}
private:
    std::mutex mutex_;
    AvatarImuSample sample_{};
    uint32_t time_=0;
    bool pending_=false;
};

// Fixed vertical reference, never a learned startup/page/grip baseline.
// Official StopWatch HAL swaps raw X/Y: raw Y is screen horizontal, raw X
// is screen vertical, raw Z is normal to the glass. Zero horizontal/depth
// gravity means upright; abs/inclination mapping also tolerates upside-down
// holding (this is not an automatic screen-rotation feature).
class AvatarTiltFilter {
public:
    void Reset() {*this=AvatarTiltFilter();} // clears smoothing only
    AvatarTilt Update(const AvatarImuSample& raw,uint32_t now) {
        if(have_sample_ && now-last_>2000) Reset();
        if(!AvatarGravityValid(raw)) return output_;
        constexpr float degrees=57.295779513f;
        const float horizontal=-std::atan2(raw.ay,std::hypot(raw.ax,raw.az))*degrees;
        const float depth=-std::atan2(raw.az,std::hypot(raw.ax,raw.ay))*degrees;
        // A continuous dead zone avoids a step when leaving the center.
        const auto gaze=[](float angle) {
            constexpr float dead=1.5f,full=25.f;
            const float magnitude=std::clamp((std::abs(angle)-dead)/(full-dead),0.f,1.f);
            return std::copysign(magnitude,angle);
        };
        const float x=gaze(horizontal),y=gaze(depth);
        if(!have_sample_) {fx_=x;fy_=y;}
        else {
            const uint32_t elapsed=std::min<uint32_t>(now-last_,100);
            const float alpha=1.f-std::exp(-static_cast<float>(elapsed)/80.f);
            fx_+=(x-fx_)*alpha;fy_+=(y-fy_)*alpha;
        }
        last_=now;have_sample_=true;
        output_={fx_,fy_,0,0,true}; // no gyro lead, no stable-hold prerequisite
        return output_;
    }
private:
    bool have_sample_=false;
    uint32_t last_=0;
    AvatarTilt output_{};
    float fx_=0,fy_=0;
};
