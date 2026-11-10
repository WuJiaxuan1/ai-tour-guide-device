#include "avatar_shake.h"
#include <cstdio>
int main() {
    for(float amplitude:{1.2f,.45f}) for(int missing_every:{0,3}) {
        AvatarShakeTracker detector;unsigned events=0;
        for(unsigned t=0;t<2000;t+=20) {
            const auto sample=AvatarImuSample{1,amplitude*std::sin(6.283185307f*2*t/1000.f),0,0,0,0};
            events+=detector.Update(!missing_every || (t/20)%missing_every!=2,sample,t);
        }
        std::printf("amplitude=%.2fg frequency=2Hz missing_every=%d triggers=%u\n",amplitude,missing_every,events);
    }
}
