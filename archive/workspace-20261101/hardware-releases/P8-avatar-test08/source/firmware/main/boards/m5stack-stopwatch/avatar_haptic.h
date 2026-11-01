#pragma once
#include <array>
#include <cstdint>
#include <functional>
#include <mutex>

enum class AvatarFeedback { Cancel, Tap, Listen };

inline std::array<uint8_t,3> AvatarMotorCommand(uint8_t strength) {
    const uint16_t duty=uint32_t(strength)*4095/255;
    return {0x1B,static_cast<uint8_t>(duty),static_cast<uint8_t>(0x80|(duty>>8))};
}

// A single expiring command; repeated UI events cannot extend a running pulse.
class AvatarHapticQueue {
public:
    struct Request {uint32_t at=0,generation=0;uint8_t strength=160;uint32_t duration=45;};
    void Enable() {std::lock_guard<std::mutex> lock(mutex_);enabled_=true;}
    void Disable() {std::lock_guard<std::mutex> lock(mutex_);enabled_=false;pending_=false;++generation_;}
    bool Push(AvatarFeedback event,uint32_t now) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(event==AvatarFeedback::Cancel) {pending_=false;++generation_;return true;}
        if(!enabled_ || busy_ || pending_) return false;
        request_={now,generation_,160,45};pending_=true;return true;
    }
    bool Take(uint32_t now,Request& request) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!enabled_ || busy_ || !pending_) return false;
        pending_=false;
        if(now-request_.at>150) return false;
        request=request_;busy_=true;return true;
    }
    uint32_t Generation() {std::lock_guard<std::mutex> lock(mutex_);return generation_;}
    void Finish() {std::lock_guard<std::mutex> lock(mutex_);busy_=false;}
private:
    std::mutex mutex_;
    Request request_;
    bool enabled_=false,pending_=false,busy_=false;
    uint32_t generation_=0;
};

// Poll only from the motor task. Write and mute callbacks are exercised with
// a simulated clock in host tests; no UI thread sleeps or performs I2C here.
class AvatarHapticRunner {
public:
    using Clock=std::function<uint32_t()>;
    AvatarHapticRunner(AvatarHapticQueue& queue,std::function<bool(uint8_t)> write,
        std::function<void(bool)> mute,Clock clock)
        :queue_(queue),write_(write),mute_(mute),clock_(clock) {}
    void Poll() {
        auto now=clock_();
        if(phase_==Phase::Idle) {
            if(!queue_.Take(now,request_)) return;
            mute_(true); // before the motor can move or disturb the IMU
            if(write_(request_.strength)) {phase_=Phase::On;started_=clock_();}
            else {failed_=true;queue_.Disable();phase_=Phase::Stopping;attempted_=false;}
        }
        now=clock_();
        if(phase_==Phase::On && (now-started_>=request_.duration || queue_.Generation()!=request_.generation)) {
            phase_=Phase::Stopping;attempted_=false;
        }
        if(phase_==Phase::Stopping && (!attempted_ || now-attempted_at_>=100)) {
            attempted_=true;attempted_at_=now;
            if(write_(0)) {phase_=Phase::Tail;stopped_=clock_();}
            else {failed_=true;queue_.Disable();} // keep retrying OFF, forbid new pulses
        }
        if(phase_==Phase::Tail && clock_()-stopped_>=180) {
            mute_(false);queue_.Finish();phase_=Phase::Idle;
        }
    }
    bool Failed() const {return failed_;}
private:
    enum class Phase {Idle,On,Stopping,Tail};
    AvatarHapticQueue& queue_;
    std::function<bool(uint8_t)> write_;
    std::function<void(bool)> mute_;
    Clock clock_;
    AvatarHapticQueue::Request request_;
    Phase phase_=Phase::Idle;
    bool failed_=false,attempted_=false;
    uint32_t started_=0,stopped_=0,attempted_at_=0;
};
