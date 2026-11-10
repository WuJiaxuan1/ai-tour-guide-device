#pragma once
// Original Grok vector poses, time interpolation and interruptible state morphs.
// This core has no ESP/LVGL dependencies so the exact renderer can be tested on PC.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <vector>

// The rest of the voice firmware optimizes for size. Keep this per-frame hot path fast.
#if defined(__GNUC__)
#pragma GCC push_options
#pragma GCC optimize ("O3")
#endif

class GrokMotion {
public:
    static constexpr int kSize = 466;
    static constexpr int kCoordinates = 416;
    static constexpr int kWords = 421;
    static constexpr int kCounts[5] = {64, 48, 48, 24, 24};
    using Pose = std::array<float, kWords>;
    struct Rect {int x1,y1,x2,y2;};
    static constexpr int kTiles=15, kMaxRects=24;

    bool Load(const void* bytes, size_t length) {
        if (!bytes || length < 32) return false;
        const auto* data = static_cast<const uint8_t*>(bytes);
        if (std::memcmp(data, "GROKVP4\0", 8) || U32(data+8) != 1 ||
            U32(data+24) != kWords || U32(data+28) != 5) return false;
        const uint32_t states=U32(data+12), frames=U32(data+16), interval=U32(data+20);
        if (!states || states>32 || frames<2 || frames>1000 || interval<10 || interval>1000) return false;
        const uint64_t expected=32ULL+states*32ULL+states*frames*kWords*2ULL;
        if (expected!=length) return false;
        for (uint32_t i=0;i<states;i++) if (!std::memchr(data+32+i*32,0,32)) return false;
        data_=data; states_=states; frames_=frames; interval_=interval;
        state_=Find("neutral"); ready_=false; morphing_=false;
        gray_.resize(kSize*kSize);
        for (int i=0;i<256;i++) colors_[i]=uint16_t((i>>3)<<11 | (i>>2)<<5 | (i>>3));
        // Physical circle spans, computed once rather than per pixel per polygon.
        for (int y=0;y<kSize;y++) {
            const float dy=y-232.5f;
            const float half=std::sqrt(std::max(0.0f,232.0f*232.0f-dy*dy));
            circle_left_[y]=int16_t(std::ceil(232.5f-half));
            circle_right_[y]=int16_t(std::floor(232.5f+half));
            if(std::abs(dy)>232) {circle_left_[y]=1;circle_right_[y]=0;}
        }
        first_frame_=true;
        return true;
    }

    bool SetState(const char* name,uint32_t now) {
        if (!data_) return false;
        const uint32_t next=Find(name);
        if (state_==next) return false; // Repeated server events never restart animation.
        Tick(now); from_=pose_; from_velocity_=velocity_;
        state_=next; morph_start_=now; morphing_=true;
        return true;
    }

    void Tick(uint32_t now) {
        if (!data_) return;
        Pose target; Sample(state_,now,target);
        if (!ready_) {pose_=target; velocity_.fill(0);last_=now;ready_=true;return;}
        const Pose previous=pose_;
        if (morphing_) {
            const float elapsed=float(uint32_t(now-morph_start_))/1000.0f;
            const float t=std::clamp(elapsed/0.55f,0.0f,1.0f);
            const float weight=t*t*(3-2*t);
            const float carry=elapsed*std::exp(-elapsed/0.18f);
            for (int i=0;i<kWords;i++) {
                const float start=from_[i]+from_velocity_[i]*carry;
                pose_[i]=start+(target[i]-start)*weight;
            }
            if (t>=1) morphing_=false;
        } else pose_=target;
        const uint32_t elapsed=uint32_t(now-last_);
        if (elapsed) {
            const float dt=float(elapsed)/1000;
            for (int i=0;i<kWords;i++) velocity_[i]=std::clamp((pose_[i]-previous[i])/dt,-1600.0f,1600.0f);
        }
        last_=now;
    }

    void Render(uint16_t* output) {
        if (!ready_ || !output) return;
        std::fill(gray_.begin(),gray_.end(),0);
        // Dots precede body in the original SVG. Black eyes are clipped by black background.
        const int offsets[5]={0,128,224,320,368};
        for (int p : {3,4,0,1,2}) {
            Polygon(pose_.data()+offsets[p],kCounts[p],p==1||p==2?0:255,
                    std::clamp(pose_[kCoordinates+p],0.0f,255.0f));
        }
        std::array<bool,kTiles*kTiles> dirty{};
        for (int y=0;y<kSize;y++) {
            const size_t row=y*kSize;
            for (int x=0;x<kSize;x++) {
                const uint16_t color=colors_[gray_[row+x]];
                if (first_frame_ || output[row+x]!=color) {
                    output[row+x]=color;
                    dirty[(y/32)*kTiles+x/32]=true;
                }
            }
        }
        BuildRects(dirty);
        first_frame_=false;
    }

    const Pose& pose() const {return pose_;}
    bool loaded() const {return data_!=nullptr;}
    void Unload() {data_=nullptr;ready_=false;morphing_=false;}
    uint32_t duration_ms() const {return frames_*interval_;}
    int dirty_count() const {return dirty_count_;}
    const Rect& dirty_rect(int i) const {return dirty_rects_[i];}
    int dirty_pixels() const {
        int pixels=0;
        for(int i=0;i<dirty_count_;i++) {const auto& r=dirty_rects_[i];pixels+=(r.x2-r.x1+1)*(r.y2-r.y1+1);}
        return pixels;
    }

private:
    static uint32_t U32(const uint8_t* p) {return uint32_t(p[0]) | uint32_t(p[1])<<8 | uint32_t(p[2])<<16 | uint32_t(p[3])<<24;}
    static int16_t I16(const uint8_t* p) {return int16_t(uint16_t(p[0]) | uint16_t(p[1])<<8);}
    uint32_t Find(const char* name) const {
        if (name) for (uint32_t i=0;i<states_;i++) if (!std::strcmp(name,reinterpret_cast<const char*>(data_+32+i*32))) return i;
        return 0;
    }
    void Sample(uint32_t state,uint32_t now,Pose& out) const {
        const uint32_t t=now%(frames_*interval_),a=t/interval_,b=(a+1)%frames_;
        const float weight=float(t%interval_)/interval_;
        const uint8_t* base=data_+32+states_*32+state*frames_*kWords*2;
        for (int i=0;i<kWords;i++) {
            const float x=I16(base+(a*kWords+i)*2),y=I16(base+(b*kWords+i)*2);
            out[i]=(x+(y-x)*weight)/(i<kCoordinates?64.0f:1.0f);
        }
    }
    void Polygon(const float* xy,int count,int color,float opacity) {
        if (opacity<0.5f) return;
        // Active-edge scan conversion: only edges crossing this row are visited.
        struct Edge {float low,high,x,slope;};
        std::array<Edge,64> edges{};int edge_count=0;
        float min_y=kSize,max_y=0;
        for(int i=0,j=count-1;i<count;j=i++) {
            float ax=xy[2*j],ay=xy[2*j+1],bx=xy[2*i],by=xy[2*i+1];
            min_y=std::min(min_y,by);max_y=std::max(max_y,by);
            if(ay==by)continue;
            if(ay>by){std::swap(ax,bx);std::swap(ay,by);}
            edges[edge_count++]={ay,by,ax,(bx-ax)/(by-ay)};
        }
        std::sort(edges.begin(),edges.begin()+edge_count,[](const Edge& a,const Edge& b){return a.low<b.low;});
        std::array<int,64> active{};int active_count=0,next_edge=0;
        const int y0=std::max(0,int(std::floor(min_y))),y1=std::min(kSize-1,int(std::ceil(max_y)));
        const int alpha=std::clamp(int(opacity+0.5f),0,255);
        for (int y=y0;y<=y1;y++) {
            // Difference spans avoid four floating-point operations per interior pixel.
            std::array<int16_t,kSize+1> difference{};
            std::array<int16_t,kSize> boundary{};
            int min_x=kSize,max_x=-1;
            for (int sample=0;sample<4;sample++) {
                const float scan=y+(sample+0.5f)/4;
                float crossings[64];int n=0;
                while(next_edge<edge_count&&edges[next_edge].low<=scan)active[active_count++]=next_edge++;
                for(int i=0;i<active_count;) {
                    const auto& edge=edges[active[i]];
                    if(edge.high<=scan){active[i]=active[--active_count];continue;}
                    crossings[n++]=edge.x+(scan-edge.low)*edge.slope;
                    i++;
                }
                std::sort(crossings,crossings+n);
                for (int k=0;k+1<n;k+=2) {
                    const float left=std::max(0.0f,crossings[k]),right=std::min(float(kSize),crossings[k+1]);
                    if (left>=right) continue;
                    const int begin=int(left),end=std::min(kSize-1,int(right));
                    min_x=std::min(min_x,begin);max_x=std::max(max_x,end);
                    if(begin==end)boundary[begin]+=int((right-left)*256+0.5f);
                    else {
                        boundary[begin]+=int((begin+1-left)*256+0.5f);
                        boundary[end]+=int((right-end)*256+0.5f);
                        if(begin+1<end){difference[begin+1]+=256;difference[end]-=256;}
                    }
                }
            }
            int inside=0;
            for (int x=min_x;x<=max_x;x++) {
                inside+=difference[x];
                if(x<circle_left_[y] || x>circle_right_[y])continue;
                const int a=(std::min(1024,inside+int(boundary[x]))*alpha+512)>>10;
                if(!a)continue;
                auto& pixel=gray_[y*kSize+x];
                if(a==255)pixel=uint8_t(color);
                else pixel=uint8_t((pixel*(255-a)+color*a+127)/255);
            }
        }
    }
    void BuildRects(const std::array<bool,kTiles*kTiles>& tiles) {
        // Merge adjacent rows, then least-cost rectangle pairs. Stay below LVGL's 32-area limit.
        std::array<Rect,kTiles*kTiles> rects{};int count=0;
        for(int y=0;y<kTiles;y++)for(int x=0;x<kTiles;) {
            if(!tiles[y*kTiles+x]){x++;continue;}
            const int begin=x;while(x<kTiles&&tiles[y*kTiles+x])x++;
            Rect r{begin*32,y*32,std::min(kSize-1,x*32-1),std::min(kSize-1,(y+1)*32-1)};
            bool joined=false;
            for(int i=0;i<count;i++)if(rects[i].x1==r.x1&&rects[i].x2==r.x2&&rects[i].y2+1==r.y1){rects[i].y2=r.y2;joined=true;break;}
            if(!joined)rects[count++]=r;
        }
        auto area=[](const Rect& r){return (r.x2-r.x1+1)*(r.y2-r.y1+1);};
        auto unite=[](const Rect& a,const Rect& b){return Rect{std::min(a.x1,b.x1),std::min(a.y1,b.y1),std::max(a.x2,b.x2),std::max(a.y2,b.y2)};};
        while(count>kMaxRects) {
            int a=0,b=1,cost=0x7fffffff;
            for(int i=0;i<count;i++)for(int j=i+1;j<count;j++) {
                const int added=area(unite(rects[i],rects[j]))-area(rects[i])-area(rects[j]);
                if(added<cost){cost=added;a=i;b=j;}
            }
            rects[a]=unite(rects[a],rects[b]);rects[b]=rects[--count];
        }
        dirty_count_=count;
        for(int i=0;i<count;i++)dirty_rects_[i]=rects[i];
    }
    const uint8_t* data_=nullptr;
    uint32_t states_=0,frames_=0,interval_=0,state_=0,last_=0,morph_start_=0;
    bool ready_=false,morphing_=false;
    Pose pose_{},velocity_{},from_{},from_velocity_{};
    std::array<uint16_t,256> colors_{};
    std::vector<uint8_t> gray_;
    std::array<int16_t,kSize> circle_left_{},circle_right_{};
    std::array<Rect,kMaxRects> dirty_rects_{};
    int dirty_count_=0;
    bool first_frame_=true;
};

#if defined(__GNUC__)
#pragma GCC pop_options
#endif
