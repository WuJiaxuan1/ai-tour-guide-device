#include "avatar_shake.h"
#include <cstdio>
#include <cstring>

int main(int argc,char** argv) {
    const bool verify=argc>1 && std::strcmp(argv[1],"--check")==0;
    unsigned total=0,passed=0;
    // Same physical trace, different acquisition phases, jitter and missed
    // polls. Include a diagonal component from a hand-held, slightly tilted grip.
    for(float amplitude:{.32f,.34f,.38f,.45f,.7f}) for(float hz:{1.8f,2.5f,3.5f,4.5f,5.5f}) {
        unsigned group=0,good=0;
        for(int diagonal:{0,1}) for(int phase=0;phase<8;++phase) for(int polling=0;polling<3;++polling) {
            AvatarShakeTracker detector;unsigned events=0;
            for(unsigned t=0,n=0;t<1800;t+=(polling==2?(n%2?32:48):20),++n) {
                const float angle=6.283185307f*(hz*t/1000.f+phase/8.f);
                const float lateral=amplitude*std::sin(angle);
                const float depth=diagonal?.95f*amplitude*std::sin(angle+.20f):0;
                events+=detector.Update(polling!=1 || n%3!=2,
                    {1+.25f*lateral,lateral,depth,0,0,0},t);
            }
            ++group;++total;if(events==1) {++good;++passed;}
        }
        std::printf("%.2fg %.1fHz: %u/%u traces triggered once\n",amplitude,hz,good,group);
    }
    std::printf("CONSISTENCY: %u/%u synthetic phase/diagonal/jitter/loss traces\n",passed,total);
    if(verify && passed!=total) return 1;
    if(verify) std::puts("PASS: avatar11 shake consistency across sampling phases and grip variation");
    return 0;
}
