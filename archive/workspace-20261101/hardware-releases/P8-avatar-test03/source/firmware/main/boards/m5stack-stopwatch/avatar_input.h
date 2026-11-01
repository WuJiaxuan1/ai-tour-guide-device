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

// Single latest-sample slot: the IMU never waits for LVGL drawing. Consumers
// discard old data instead of replaying a backlog after a busy frame/page change.
class AvatarMotionMailbox {
public:
    void Publish(bool valid,const AvatarImuSample& sample,uint32_t now) {
        if(!valid) return;
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

// Gravity supplies the sustained gaze; gyro supplies transient lead. This is
// a gesture filter, not an orientation/navigation estimator. Axis/sign mapping
// follows the StopWatch upstream avatar implementation.
class AvatarTiltFilter {
public:
    void Reset() {*this=AvatarTiltFilter();}
    uint32_t RecenterCount() const {return recenters_;}
    AvatarTilt Update(const AvatarImuSample& raw,uint32_t now) {
        // Preserve a usable reference across short stalls/jolts. Recalibration
        // is reserved for a real outage, page activation or a large grip change.
        if(have_sample_ && now-last_>2000) Reset();
        const float values[]={raw.ax,raw.ay,raw.az,raw.gx,raw.gy,raw.gz};
        for(float value:values) if(!std::isfinite(value)) {ClearCandidate();return output_;}
        const float norm=std::sqrt(raw.ax*raw.ax+raw.ay*raw.ay+raw.az*raw.az);
        if(norm<0.6f || norm>1.5f) {ClearCandidate();return output_;}
        const uint32_t elapsed=have_sample_?std::min<uint32_t>(now-last_,100):40;
        const float x=raw.ay,y=raw.ax; // sensor axes -> screen axes
        const bool stable=std::max({std::abs(raw.gx),std::abs(raw.gy),std::abs(raw.gz)})<8 &&
            (!have_sample_ || std::max({std::abs(raw.ax-prev_.ax),std::abs(raw.ay-prev_.ay),std::abs(raw.az-prev_.az)})<0.035f);
        if(!have_sample_) {fx_=x;fy_=y;}
        prev_=raw;last_=now;have_sample_=true;
        const float alpha=1.f-std::exp(-static_cast<float>(elapsed)/120.f);
        fx_+=(x-fx_)*alpha;fy_+=(y-fy_)*alpha;
        // A desk-to-hand rotation is substantially larger than a normal
        // 10-25 degree interaction. Ordinary held tilts must not be re-zeroed.
        const float distance=std::sqrt((x-nx_)*(x-nx_)+(y-ny_)*(y-ny_)+(raw.az-nz_)*(raw.az-nz_));
        const bool new_grip=ready_ && distance>0.9f && norm>0.85f && norm<1.15f;
        if(!ready_ || new_grip) {
            if(!stable) {ClearCandidate();if(!ready_) return {};}
            else {
                if(count_==0) candidate_started_=now;
                sum_x_+=x;sum_y_+=y;sum_z_+=raw.az;sum_gx_+=raw.gx;sum_gy_+=raw.gy;
                ++count_;
                if(count_>=20 && now-candidate_started_>=700) {
                    if(ready_) ++recenters_;
                    nx_=sum_x_/count_;ny_=sum_y_/count_;nz_=sum_z_/count_;
                    bias_gx_=sum_gx_/count_;bias_gy_=sum_gy_/count_;ready_=true;
                    fx_=nx_;fy_=ny_;ClearCandidate();
                }
                if(!ready_) return {};
            }
        } else ClearCandidate();
        const auto clamp=[](float value){return std::clamp(value,-1.f,1.f);};
        const auto dead=[](float value){return std::abs(value)<0.025f?0.f:value;};
        output_={dead(clamp(-(fx_-nx_)/0.28f)),dead(clamp(-(fy_-ny_)/0.28f)),
            clamp(-(raw.gx-bias_gx_)/180.f),clamp((raw.gy-bias_gy_)/180.f),true};
        return output_;
    }
private:
    bool ready_=false,have_sample_=false;
    int count_=0;
    uint32_t last_=0,candidate_started_=0,recenters_=0;
    AvatarImuSample prev_{};
    AvatarTilt output_{};
    float fx_=0,fy_=0,nx_=0,ny_=0,nz_=0,bias_gx_=0,bias_gy_=0;
    float sum_x_=0,sum_y_=0,sum_z_=0,sum_gx_=0,sum_gy_=0;
    void ClearCandidate() {count_=0;sum_x_=sum_y_=sum_z_=sum_gx_=sum_gy_=0;}
};
