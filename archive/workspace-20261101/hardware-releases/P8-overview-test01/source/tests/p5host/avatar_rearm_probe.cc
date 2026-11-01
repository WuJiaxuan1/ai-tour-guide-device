#include "avatar_shake.h"
#include <cstdio>
int main() {
    AvatarShakeTracker tracker;unsigned events=0;
    for(uint32_t t=0;t<800;t+=20)
        events+=tracker.Update(true,{1,1.2f*std::sin(6.283185307f*3*t/1000.f),0,0,0,0},t);
    std::printf("after first shake: events=%u\n",events);
    // Continuing small hand motion: below the gesture threshold, but enough
    // to prevent the old continuous-quiet prerequisite from ever completing.
    for(uint32_t t=800;t<4000;t+=20)
        events+=tracker.Update(true,{1,(t/20)%2?.22f:-.22f,0,0,0,0},t);
    for(uint32_t t=4000;t<5400;t+=20)
        events+=tracker.Update(true,{1,1.2f*std::sin(6.283185307f*3*(t-4000)/1000.f),0,0,0,0},t);
    std::printf("after second shake without page switch or quiet hold: events=%u\n",events);
}
