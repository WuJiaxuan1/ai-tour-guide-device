// SPDX-License-Identifier: AGPL-3.0-or-later
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>

// A clipped RGB565 target. No LCD access: LVGL owns presentation and its lock
// serializes rendering with image reads. Storage belongs to AvatarDisplay.
class AvatarSurface {
public:
    AvatarSurface(uint16_t* pixels, int width, int height)
        : pixels_(pixels), width_(width), height_(height) {}
    int width() const { return width_; }
    int height() const { return height_; }
    void startWrite() { dirty_ = false; }
    void endWrite() {}
    bool Dirty(int& x1, int& y1, int& x2, int& y2) const {
        x1=x1_; y1=y1_; x2=x2_; y2=y2_; return dirty_;
    }
    static uint16_t color565(int r,int g,int b) {
        return ((r & 248) << 8) | ((g & 252) << 3) | (b >> 3);
    }
    void fillScreen(uint16_t color) { fillRect(0,0,width_,height_,color); }
    void fillRect(int x,int y,int w,int h,uint16_t color) {
        const int right=std::min(width_,x+w), bottom=std::min(height_,y+h);
        x=std::max(0,x); y=std::max(0,y);
        if(x>=right || y>=bottom) return;
        Mark(x,y,right-1,bottom-1);
        for(int row=y;row<bottom;++row)
            std::fill(pixels_+row*width_+x,pixels_+row*width_+right,color);
    }
    void fillCircle(int x,int y,int r,uint16_t color) {
        if(r<0) return;
        for(int row=std::max(-r,-y);row<=std::min(r,height_-1-y);++row) {
            const int dx=static_cast<int>(std::sqrt(float(r*r-row*row)));
            fillRect(x-dx,y+row,dx*2+1,1,color);
        }
    }
    void fillRoundRect(int x,int y,int w,int h,int r,uint16_t color) {
        if(w<=0 || h<=0) return;
        r=std::clamp(r,0,std::min(w,h)/2);
        for(int row=std::max(0,-y);row<std::min(h,height_-y);++row) {
            int inset=0;
            if(r>0 && (row<r || row>=h-r)) {
                const float dy=row<r ? r-row-0.5f : row-(h-r)+0.5f;
                inset=std::max(0,static_cast<int>(std::ceil(r-std::sqrt(std::max(0.f,r*r-dy*dy))-0.5f)));
            }
            fillRect(x+inset,y+row,w-2*inset,1,color);
        }
    }
    void fillTriangle(int ax,int ay,int bx,int by,int cx,int cy,uint16_t color) {
        const int xs[]={ax,bx,cx}, ys[]={ay,by,cy};
        const int top=std::max(0,std::min({ay,by,cy}));
        const int bottom=std::min(height_-1,std::max({ay,by,cy}));
        for(int y=top;y<=bottom;++y) {
            float left=1e9f,right=-1e9f;
            for(int i=0;i<3;++i) {
                const int j=(i+1)%3;
                if(y<std::min(ys[i],ys[j]) || y>std::max(ys[i],ys[j])) continue;
                if(ys[i]==ys[j]) {
                    left=std::min(left,float(std::min(xs[i],xs[j])));
                    right=std::max(right,float(std::max(xs[i],xs[j])));
                } else {
                    float x=xs[i]+float(y-ys[i])*(xs[j]-xs[i])/(ys[j]-ys[i]);
                    left=std::min(left,x);right=std::max(right,x);
                }
            }
            if(left<=right) {
                const int x=static_cast<int>(std::floor(left));
                fillRect(x,y,static_cast<int>(std::ceil(right))-x+1,1,color);
            }
        }
    }
    void drawLine(int x,int y,int x2,int y2,uint16_t color) {
        int dx=std::abs(x2-x),sx=x<x2?1:-1,dy=-std::abs(y2-y),sy=y<y2?1:-1,error=dx+dy;
        for(;;) {
            fillRect(x,y,1,1,color);
            if(x==x2 && y==y2) break;
            int twice=2*error;
            if(twice>=dy) {error+=dy;x+=sx;}
            if(twice<=dx) {error+=dx;y+=sy;}
        }
    }
    void drawWideLine(int x,int y,int x2,int y2,float radius,uint16_t color) {
        const float dx=x2-x,dy=y2-y,len=std::sqrt(dx*dx+dy*dy);
        if(len>0) {
            const int ox=std::lround(-dy*radius/len),oy=std::lround(dx*radius/len);
            fillTriangle(x+ox,y+oy,x-ox,y-oy,x2+ox,y2+oy,color);
            fillTriangle(x-ox,y-oy,x2-ox,y2-oy,x2+ox,y2+oy,color);
        }
        fillCircle(x,y,std::lround(radius),color);fillCircle(x2,y2,std::lround(radius),color);
    }
private:
    uint16_t* pixels_;
    int width_,height_,x1_=0,y1_=0,x2_=0,y2_=0;
    bool dirty_=false;
    void Mark(int x,int y,int right,int bottom) {
        if(!dirty_) {x1_=x;y1_=y;x2_=right;y2_=bottom;dirty_=true;}
        else {x1_=std::min(x1_,x);y1_=std::min(y1_,y);x2_=std::max(x2_,right);y2_=std::max(y2_,bottom);}
    }
};
