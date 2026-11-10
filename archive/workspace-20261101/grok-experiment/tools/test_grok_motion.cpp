#include "firmware-source/main/boards/m5stack-stopwatch/grok_motion.h"
#include <cassert>
#include <chrono>
#include <fstream>
#include <iostream>
#include <iterator>

int main(int argc,char**) {
    std::ifstream file("grok-v4/grok-vectors.bin",std::ios::binary);
    std::vector<uint8_t> bank((std::istreambuf_iterator<char>(file)),{});
    assert(!bank.empty());GrokMotion animation;
    assert(!animation.Load(bank.data(),31));
    assert(!animation.Load(bank.data(),bank.size()-1));
    auto damaged=bank;damaged[24]=0;assert(!animation.Load(damaged.data(),damaged.size()));
    assert(animation.Load(bank.data(),bank.size()));
    animation.Tick(100);const auto initial=animation.pose();
    assert(!animation.SetState("neutral",100));assert(animation.pose()==initial);
    assert(animation.SetState("happy",100));assert(animation.pose()==initial);
    animation.Tick(180);const auto midway=animation.pose();
    assert(animation.SetState("angry",180));assert(animation.pose()==midway);
    std::vector<uint16_t> pixels(466*466);
    const auto start=std::chrono::steady_clock::now();
    const char* names[]={"neutral","happy","laughing","sad","angry","confused","thinking","surprised","sleepy","confident","embarrassed","shocked","funny","silly","relaxed","cool","loving","kissy","crying","delicious","winking","listening"};
    uint32_t now=200;
    for(const char* name:names) {
        animation.SetState(name,now);
        for(int frame=0;frame<40;frame++) {
            now+=40;animation.Tick(now);animation.Render(pixels.data());
            for(float v:animation.pose())assert(std::isfinite(v));
            assert(pixels[0]==0&&pixels[465]==0&&pixels.back()==0);
            assert(std::any_of(pixels.begin(),pixels.end(),[](uint16_t p){return p>0;}));
        }
    }
    auto elapsed=std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count();
    // Exact cycle repeat and continuous seam (within a normal frame's motion).
    GrokMotion loop;assert(loop.Load(bank.data(),bank.size()));loop.Tick(0);auto first=loop.pose();
    loop.Tick(loop.duration_ms());assert(loop.pose()==first);
    loop.Tick(loop.duration_ms()-1);auto before=loop.pose();
    float jump=0;for(int i=0;i<GrokMotion::kCoordinates;i++)jump=std::max(jump,std::abs(first[i]-before[i]));
    assert(jump<2.0f);
    std::cout<<"PASS: format rejection, all 22 states, finite poses, circular aperture, same-state continuity, interrupted morph, seamless cycle\n";
    std::cout<<"Desktop renderer: "<<880/elapsed<<" frames/s (not a device benchmark)\n";
    if(argc>1) {
        GrokMotion demo;assert(demo.Load(bank.data(),bank.size()));
        std::ofstream raw("grok-v4/preview-frames.rgb565",std::ios::binary);
        const char* states[]={"neutral","happy","thinking","angry","winking","neutral"};
        for(uint32_t t=0;t<12000;t+=40) {
            if(t%2000==0)demo.SetState(states[t/2000],t);
            demo.Tick(t);demo.Render(pixels.data());
            raw.write(reinterpret_cast<const char*>(pixels.data()),pixels.size()*2);
        }
        std::cout<<"Preview: 300 RGB565 frames, same C++ renderer as firmware\n";
    }
}
