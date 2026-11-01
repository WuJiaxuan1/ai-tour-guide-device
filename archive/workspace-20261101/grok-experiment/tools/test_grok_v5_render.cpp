#define GrokMotion OldGrokMotion
#include "grok-v5/source-v4-baseline/grok_motion.h"
#undef GrokMotion
#include "firmware-source/main/boards/m5stack-stopwatch/grok_motion.h"
#include <cassert>
#include <chrono>
#include <fstream>
#include <iostream>
#include <iterator>

int gray(uint16_t p){return ((p>>5)&63)*255/63;}
int main() {
    std::ifstream file("grok-v4/grok-vectors.bin",std::ios::binary);
    std::vector<uint8_t> bank((std::istreambuf_iterator<char>(file)),{});
    OldGrokMotion before;GrokMotion after;
    assert(before.Load(bank.data(),bank.size()));assert(after.Load(bank.data(),bank.size()));
    std::vector<uint16_t> old_pixels(466*466),new_pixels(466*466),previous(466*466);
    const char* names[]={"neutral","happy","laughing","sad","angry","confused","thinking","surprised","sleepy","confident","embarrassed","shocked","funny","silly","relaxed","cool","loving","kissy","crying","delicious","winking","listening"};
    uint64_t error=0,changed=0,area=0,total=0;int maximum=0;
    double old_seconds=0,new_seconds=0;
    uint32_t now=100;
    std::ofstream samples("grok-v5/renderer-samples.rgb565",std::ios::binary);
    for(const char* name:names) {
        before.SetState(name,now);after.SetState(name,now);
        for(int f=0;f<80;f++) {
            now+=17;before.Tick(now);after.Tick(now);previous=new_pixels;
            auto a=std::chrono::steady_clock::now();before.Render(old_pixels.data());auto b=std::chrono::steady_clock::now();after.Render(new_pixels.data());auto c=std::chrono::steady_clock::now();
            old_seconds+=std::chrono::duration<double>(b-a).count();new_seconds+=std::chrono::duration<double>(c-b).count();
            assert(before.pose()==after.pose());
            assert(after.dirty_count()<=24);
            std::array<bool,15*15> covered{};
            for(int r=0;r<after.dirty_count();r++) {
                const auto& rect=after.dirty_rect(r);
                assert(rect.x1>=0&&rect.y1>=0&&rect.x2<466&&rect.y2<466);
                for(int y=rect.y1/32;y<=rect.y2/32;y++)for(int x=rect.x1/32;x<=rect.x2/32;x++)covered[y*15+x]=true;
            }
            area+=after.dirty_pixels();
            for(size_t i=0;i<new_pixels.size();i++) {
                int difference=std::abs(gray(old_pixels[i])-gray(new_pixels[i]));
                maximum=std::max(maximum,difference);error+=difference;total++;
                if(new_pixels[i]!=previous[i]) {changed++;assert(covered[(i/466/32)*15+(i%466/32)]);}
            }
            if(f==24||f==60)samples.write(reinterpret_cast<const char*>(new_pixels.data()),new_pixels.size()*2);
            after.Render(new_pixels.data());assert(after.dirty_count()==0); // No stale pixels or needless transfer.
        }
    }
    const double mean=double(error)/total;
    assert(mean<0.5);assert(maximum<=16);
    std::cout<<"PASS: 22 states, exact animation poses, all changed pixels covered, <=24 dirty rectangles, unchanged frames transfer nothing\n";
    std::cout<<"AA comparison to v4: mean "<<mean<<" /255, max "<<maximum<<" /255\n";
    std::cout<<"Desktop render time: v4 "<<old_seconds<<" s, v5 "<<new_seconds<<" s; ratio "<<old_seconds/new_seconds<<"x (NOT device FPS)\n";
    std::cout<<"Dirty area "<<double(area)*100/total<<"% of full frames; changed pixels "<<double(changed)*100/total<<"%\n";
}
