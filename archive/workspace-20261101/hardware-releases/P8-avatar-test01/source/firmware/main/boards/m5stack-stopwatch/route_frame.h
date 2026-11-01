#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace RouteWire {
constexpr size_t kHeader=80, kMaxPoints=2048, kMaxBytes=kHeader+kMaxPoints*16;
struct Point {
    double lat=0,lng=0;
    bool Valid() const {return std::isfinite(lat)&&std::isfinite(lng)&&std::abs(lat)<85&&std::abs(lng)<=180;}
};
struct Palette {uint32_t route=0xff4fb4,position=0x008cff,destination=0xffb547,outline=0xffffff,traveled=0x888888;uint16_t width=8;};
struct Frame {
    uint32_t revision=0,crc=0;std::string session;bool active=false,reset_progress=false;Palette palette;Point destination;
    std::vector<Point> points;
};
inline uint32_t Read32(const uint8_t* p) {return uint32_t(p[0])|(uint32_t(p[1])<<8)|(uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);}
inline double Real(const uint8_t* p) {uint64_t bits=uint64_t(Read32(p))|(uint64_t(Read32(p+4))<<32);double result;memcpy(&result,&bits,8);return result;}
inline uint32_t Checksum(const uint8_t* data,size_t length) {
    uint32_t crc=0xffffffff;
    for(size_t i=0;i<length;++i) {
        crc^=i>=20&&i<24?0:data[i];
        for(int bit=0;bit<8;++bit) crc=(crc>>1)^(0xedb88320u&(0u-(crc&1u)));
    }
    return ~crc;
}
inline bool Parse(const uint8_t* b,size_t length,Frame& out) {
    if(length<kHeader || length>kMaxBytes || memcmp(b,"QRTE",4) || b[4]!=1 || b[5]>1 || b[6]!=1 || b[7]) return false;
    const uint32_t count=Read32(b+12);
    if((b[5] && (count<2 || count>kMaxPoints)) || (!b[5] && count) || length!=kHeader+count*16 || Read32(b+16)!=length) return false;
    const auto revision=Read32(b+8);
    if(!revision || revision>2000000000 || Checksum(b,length)!=Read32(b+20) || b[62]>1 || b[63]) return false;
    for(size_t i=40;i<60;i+=4) if(Read32(b+i)>0xffffff) return false;
    const auto width=uint16_t(b[60])|(uint16_t(b[61])<<8);
    if(width<2 || width>16) return false;
    Point destination{Real(b+64),Real(b+72)};
    if(!destination.Valid() || (!b[5] && (destination.lat!=0 || destination.lng!=0))) return false;
    for(uint32_t i=0;i<count;++i) if(!Point{Real(b+kHeader+i*16),Real(b+kHeader+i*16+8)}.Valid()) return false;
    out.revision=revision;out.crc=Read32(b+20);out.active=b[5];out.destination=destination;
    out.reset_progress=b[62]==1;
    out.palette={Read32(b+40),Read32(b+44),Read32(b+48),Read32(b+52),Read32(b+56),uint16_t(width)};
    static constexpr char hex[]="0123456789abcdef";out.session.clear();
    for(size_t i=24;i<40;++i) {out.session+=hex[b[i]>>4];out.session+=hex[b[i]&15];}
    out.points.clear();out.points.reserve(count);
    for(uint32_t i=0;i<count;++i) out.points.push_back({Real(b+kHeader+i*16),Real(b+kHeader+i*16+8)});
    return true;
}
struct Segment {double x0,y0,x1,y1;};
inline bool Clip(Segment& s,double size) {
    const double dx=s.x1-s.x0,dy=s.y1-s.y0;
    const double p[]={-dx,dx,-dy,dy},q[]={s.x0,size-s.x0,s.y0,size-s.y0};
    double lo=0,hi=1;
    for(int i=0;i<4;++i) {
        if(p[i]==0) {if(q[i]<0) return false;}
        else {const double r=q[i]/p[i];if(p[i]<0) lo=std::max(lo,r);else hi=std::min(hi,r);if(lo>hi) return false;}
    }
    s={s.x0+lo*dx,s.y0+lo*dy,s.x0+hi*dx,s.y0+hi*dy};return true;
}
}
