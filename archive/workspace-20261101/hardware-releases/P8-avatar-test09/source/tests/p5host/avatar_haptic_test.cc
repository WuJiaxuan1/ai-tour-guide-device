#include "avatar_haptic.h"
#include <cassert>
#include <cstdio>
#include <vector>

struct Rig {
    AvatarHapticQueue queue;
    uint32_t now=100;
    bool muted=false,fail_on=false;
    int fail_off=0;
    uint32_t write_delay=0;
    std::vector<std::pair<uint32_t,uint8_t>> writes;
    AvatarHapticRunner runner;
    Rig():runner(queue,[this](uint8_t value) {
        assert(muted);writes.emplace_back(now,value);now+=write_delay;
        if(value && fail_on) return false;
        if(!value && fail_off>0) {--fail_off;return false;}
        return true;
    },[this](bool value){muted=value;},[this](){return now;}) {queue.Enable();}
    void PollAt(uint32_t time) {now=time;runner.Poll();}
};
int main() {
    const auto off=AvatarMotorCommand(0),max=AvatarMotorCommand(255),light=AvatarMotorCommand(160);
    assert(off[0]==0x1B && off[1]==0 && off[2]==0x80);
    assert(max[1]==0xFF && max[2]==0x8F);
    assert((light[1]|((light[2]&15)<<8))==160*4095/255);
    Rig pulse;assert(pulse.queue.Push(AvatarFeedback::Tap,pulse.now));pulse.runner.Poll();
    assert(pulse.muted && pulse.writes.size()==1 && pulse.writes[0].second==160);
    for(uint32_t t=105;t<145;t+=5) {
        assert(!pulse.queue.Push(AvatarFeedback::Tap,t));pulse.PollAt(t);
        assert(pulse.writes.size()==1);
    }
    pulse.PollAt(145);assert(pulse.writes.size()==2 && pulse.writes.back().second==0);
    pulse.PollAt(324);assert(pulse.muted);
    pulse.PollAt(325);assert(!pulse.muted);
    assert(pulse.queue.Push(AvatarFeedback::Listen,330));pulse.PollAt(330);
    assert(pulse.writes.size()==3);
    pulse.queue.Push(AvatarFeedback::Cancel,335);pulse.PollAt(335);
    assert(pulse.writes.back().second==0);pulse.PollAt(515);assert(!pulse.muted);
    Rig expired;expired.queue.Push(AvatarFeedback::Tap,100);expired.PollAt(251);
    assert(expired.writes.empty());
    expired.queue.Push(AvatarFeedback::Tap,300);expired.queue.Push(AvatarFeedback::Cancel,301);expired.PollAt(305);
    assert(expired.writes.empty());
    // Actual successful-write time defines pulse and mechanical tail deadlines.
    Rig delayed;delayed.write_delay=20;delayed.queue.Push(AvatarFeedback::Tap,100);delayed.runner.Poll();
    delayed.PollAt(164);assert(delayed.writes.size()==1);
    delayed.PollAt(165);assert(delayed.now==185 && delayed.writes.back().second==0);
    delayed.PollAt(364);assert(delayed.muted);delayed.PollAt(365);assert(!delayed.muted);
    // A failed start might have partially reached the motor: always attempt OFF.
    Rig start_fail;start_fail.fail_on=true;start_fail.queue.Push(AvatarFeedback::Tap,100);start_fail.runner.Poll();
    assert(start_fail.runner.Failed() && start_fail.writes.size()==2 && start_fail.writes.back().second==0);
    start_fail.PollAt(280);assert(!start_fail.muted);
    assert(!start_fail.queue.Push(AvatarFeedback::Tap,500));
    // Never release suppression or accept another pulse until OFF is acknowledged.
    Rig stop_fail;stop_fail.fail_off=2;stop_fail.queue.Push(AvatarFeedback::Tap,100);stop_fail.runner.Poll();
    stop_fail.PollAt(145);assert(stop_fail.runner.Failed());
    stop_fail.PollAt(244);assert(stop_fail.writes.size()==2 && stop_fail.muted);
    stop_fail.PollAt(245);assert(stop_fail.writes.size()==3);
    stop_fail.PollAt(345);assert(stop_fail.writes.size()==4 && stop_fail.muted);
    stop_fail.PollAt(525);assert(!stop_fail.muted);
    assert(!stop_fail.queue.Push(AvatarFeedback::Tap,600));
    Rig wrapped;wrapped.now=0xfffffff0u;wrapped.queue.Push(AvatarFeedback::Tap,wrapped.now);wrapped.runner.Poll();
    wrapped.PollAt(29);assert(wrapped.writes.back().second==0);
    wrapped.PollAt(209);assert(!wrapped.muted);
    AvatarHapticQueue unavailable;assert(!unavailable.Push(AvatarFeedback::Tap,100));
    std::puts("PASS: avatar08 haptic PWM encoding, bounded pulse/tail, cancellation/expiry, no backlog, delayed I2C acknowledgments, start/stop fault recovery and clock wrap");
}
