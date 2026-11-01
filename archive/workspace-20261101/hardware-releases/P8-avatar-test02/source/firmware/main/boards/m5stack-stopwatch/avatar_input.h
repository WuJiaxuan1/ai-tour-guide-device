#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>

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

// Gravity supplies the sustained gaze; gyro supplies transient lead. This is
// a gesture filter, not an orientation/navigation estimator. Axis/sign mapping
// follows the StopWatch upstream avatar implementation.
class AvatarTiltFilter {
public:
    void Reset() {*this=AvatarTiltFilter();}
    AvatarTilt Update(const AvatarImuSample& raw,uint32_t now) {
        const float values[]={raw.ax,raw.ay,raw.az,raw.gx,raw.gy,raw.gz};
        for(float value:values) if(!std::isfinite(value)) {Reset();return {};}
        const float norm=std::sqrt(raw.ax*raw.ax+raw.ay*raw.ay+raw.az*raw.az);
        if(norm<0.6f || norm>1.5f) {Reset();return {};}
        if(have_sample_ && now-last_>250) Reset();
        const float x=raw.ay,y=raw.ax; // sensor axes -> screen axes
        const bool stable=std::max({std::abs(raw.gx),std::abs(raw.gy),std::abs(raw.gz)})<8 &&
            (!have_sample_ || std::max({std::abs(raw.ax-prev_.ax),std::abs(raw.ay-prev_.ay),std::abs(raw.az-prev_.az)})<0.035f);
        if(!have_sample_) {fx_=x;fy_=y;}
        prev_=raw;last_=now;have_sample_=true;
        fx_+=(x-fx_)*0.24f;fy_+=(y-fy_)*0.24f;
        if(!ready_) {
            if(!stable) {count_=0;sum_x_=sum_y_=sum_gx_=sum_gy_=0;return {};}
            sum_x_+=x;sum_y_+=y;sum_gx_+=raw.gx;sum_gy_+=raw.gy;
            if(++count_<20) return {};
            nx_=sum_x_/count_;ny_=sum_y_/count_;
            bias_gx_=sum_gx_/count_;bias_gy_=sum_gy_/count_;ready_=true;
        }
        const auto clamp=[](float value){return std::clamp(value,-1.f,1.f);};
        const auto dead=[](float value){return std::abs(value)<0.025f?0.f:value;};
        return {dead(clamp(-(fx_-nx_)/0.28f)),dead(clamp(-(fy_-ny_)/0.28f)),
            clamp(-(raw.gx-bias_gx_)/180.f),clamp((raw.gy-bias_gy_)/180.f),true};
    }
private:
    bool ready_=false,have_sample_=false;
    int count_=0;
    uint32_t last_=0;
    AvatarImuSample prev_{};
    float fx_=0,fy_=0,nx_=0,ny_=0,bias_gx_=0,bias_gy_=0;
    float sum_x_=0,sum_y_=0,sum_gx_=0,sum_gy_=0;
};
