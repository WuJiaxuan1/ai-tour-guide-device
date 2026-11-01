#include "map_frame.h"
#include <fstream>
#include <iterator>
#include <cassert>
#include <iostream>
static std::vector<uint8_t> Read(const char* path){std::ifstream f(path,std::ios::binary);return {std::istreambuf_iterator<char>(f),{}};}
int main(int argc,char** argv){
    assert(argc==3);auto map=Read(argv[1]),route=Read(argv[2]);MapWire::Header h;RouteWire::Frame r;
    assert(MapWire::Parse(map.data(),map.size(),h)&&h.overview);
    assert(MapWire::Crc32(map.data()+96,map.size()-96)==h.crc);
    assert(RouteWire::Parse(route.data(),route.size(),r)&&r.active&&r.reset_progress);
    assert(h.session==r.session&&h.route_geometry_crc==r.geometry_crc);
    for(const auto& p:r.points){double x,y;assert(h.bounds.Project(p.lat,p.lng,x,y,480));assert(std::hypot(x-240,y-240)<=199);}
    MapFrameMailbox mailbox;mailbox.SetActive(true);uint32_t ticket;assert(mailbox.Begin(ticket));
    auto frame=std::make_shared<MapFrame>(h.Bytes());frame->header=h;assert(mailbox.Commit(frame,ticket));mailbox.Displayed(*mailbox.Take());
    assert(mailbox.SetRoute(std::make_shared<RouteWire::Frame>(r),ticket));
    mailbox.SetActive(false);assert(!mailbox.SetRoute(std::make_shared<RouteWire::Frame>(r),ticket));
    route.back()^=1;assert(!RouteWire::Parse(route.data(),route.size(),r));
    std::cout<<"PASS: real server QMAP/QRTE accepted by production firmware parsers; circular fit, CRC/session, mailbox and page cancellation verified\n";
}
