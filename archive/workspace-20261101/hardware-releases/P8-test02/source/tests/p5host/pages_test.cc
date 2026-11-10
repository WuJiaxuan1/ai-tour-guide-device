#include "stopwatch_pages.h"
#include <cassert>
#include <cstdio>
#include "swipe_tracker.h"
#include <cstring>

static unsigned char buffer[466 * 20 * 2];
static uint16_t framebuffer[466 * 466];
static void Advance(int milliseconds) {
    for (int i = 0; i < milliseconds; i += 10) {
        lv_tick_inc(10);
        lv_timer_handler();
    }
}
int main() {
    lv_init();
    auto display = lv_display_create(466, 466);
    lv_display_set_color_format(display, LV_COLOR_FORMAT_RGB565);
    lv_display_set_buffers(display, buffer, nullptr, sizeof(buffer), LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(display, [](lv_display_t* d, const lv_area_t* a, uint8_t* data) {
        for(int y=a->y1;y<=a->y2;++y) {
            memcpy(framebuffer+y*466+a->x1,data+(y-a->y1)*(a->x2-a->x1+1)*2,(a->x2-a->x1+1)*2);
        }
        lv_display_flush_ready(d);
    });
    auto screen = lv_screen_active();
    auto old_status = lv_label_create(screen);
    auto old_chat = lv_label_create(screen);
    lv_label_set_text(old_chat, "old chat");
    StopwatchPages pages;
    pages.Initialize(screen, 466, 466);
    pages.Initialize(screen, 466, 466); // repeated setup must not duplicate objects
    assert(lv_obj_get_child_count(screen) == 2);
    auto voice = lv_obj_get_child(screen, 0);
    auto map = lv_obj_get_child(screen, 1);
    assert(lv_obj_get_parent(old_chat) == voice);
    lv_obj_update_layout(screen);
    assert(lv_obj_get_x(voice) == 0 && lv_obj_get_x(map) == 466);
    const auto children = lv_obj_get_child_count(map);
    pages.ShowMap(true);
    Advance(100);
    lv_obj_update_layout(screen);
    assert(lv_obj_get_x(map) > 0 && lv_obj_get_x(map) < 466);
    pages.ShowMap(false); // reverse in the middle of an animation
    Advance(300);
    lv_obj_update_layout(screen);
    assert(lv_obj_get_x(voice) == 0 && lv_obj_get_x(map) == 466);
    for (int i = 0; i < 100; ++i) {
        pages.ShowMap(true);
        pages.ShowMap(true); // right boundary
        Advance(300);
        lv_obj_update_layout(screen);
        assert(pages.IsMapShown());
        assert(lv_obj_get_x(voice) == -466 && lv_obj_get_x(map) == 0);
        lv_label_set_text(old_status, "late cloud status");
        lv_label_set_text(old_chat, "late cloud response");
        pages.SetStatus("P5 192.168.1.2:8765\nRX #10 total 10\nVOL 85");
        assert(lv_obj_get_parent(old_chat) == voice && lv_obj_get_x(voice) == -466);
        pages.ShowMap(false);
        pages.ShowMap(false); // left boundary
        Advance(300);
        lv_obj_update_layout(screen);
        assert(!pages.IsMapShown());
        assert(lv_obj_get_x(voice) == 0 && lv_obj_get_x(map) == 466);
        assert(lv_obj_get_child_count(screen) == 2 && lv_obj_get_child_count(map) == children);
    }
    auto red=std::make_shared<MapFrame>();
    for(size_t i=0;i<MapWire::kBytes;i+=2) { red->pixels.get()[i]=0; red->pixels.get()[i+1]=0xf8; }
    assert(!pages.SetImage(red)); // cannot install into hidden voice state
    pages.ShowMap(true); Advance(300);
    assert(pages.SetImage(red)); Advance(100);
    assert(framebuffer[233*466+233]==0xf800);
    std::weak_ptr<MapFrame> old=red; red.reset();
    auto green=std::make_shared<MapFrame>();
    for(size_t i=0;i<MapWire::kBytes;i+=2) { green->pixels.get()[i]=0xe0; green->pixels.get()[i+1]=7; }
    assert(pages.SetImage(green)); Advance(100);
    assert(old.expired() && framebuffer[233*466+233]==0x07e0);
    pages.ShowMap(false); Advance(300); pages.ShowMap(true); Advance(300);
    assert(framebuffer[233*466+233]==0x07e0); // cache survives page switches

    green->header.geo=true; green->header.bounds={32.01,118.79,32.0,118.80};
    assert(pages.SetImage(green));
    Advance(100);
    assert(framebuffer[100*466+100]==0x07e0 && framebuffer[365*466+365]==0x07e0);
    assert(framebuffer[233*466+2]==0x07e0 && framebuffer[233*466+463]==0x07e0);
    MapWire::Position position;position.valid=true;position.seq=1;position.lat=32.005;position.lng=118.795;
    position.accuracy=8;position.received_ms=1000;
    pages.SetPosition(position,1000);Advance(100);
    assert(framebuffer[233*466+233]!=0x07e0); // blue point at geo-projected center
    position.lng=118.7975;pages.SetPosition(position,2000);Advance(100);
    assert(framebuffer[233*466+233]==0x07e0 && framebuffer[233*466+350]!=0x07e0);
    pages.SetPosition(position,16001);Advance(100);
    assert(framebuffer[233*466+350]==0x07e0); // expiry clears point, retains basemap
    position.accuracy=100;pages.SetPosition(position,2000);Advance(100);
    assert(framebuffer[233*466+350]==0x07e0);
    position.accuracy=8;position.lng=119;pages.SetPosition(position,2000);Advance(100);
    assert(framebuffer[233*466+350]==0x07e0); // outside map must not clamp to edge
    green->header.geo=false;assert(pages.SetImage(green));Advance(100);
    assert(framebuffer[233*466+233]==0x07e0 && framebuffer[100*466+100]!=0x07e0);
    puts("PASS: P7-test03 actual LVGL full-screen edges, scaled GPS marker movement, stale/low-accuracy/out-of-map hiding, return to P6 image layout");

    // Large blocks retain the old 240-pixel scale and move a bounded viewport.
    auto chunk=std::make_shared<MapFrame>(MapWire::kChunkBytes);
    chunk->header.geo=true;chunk->header.chunk=true;chunk->header.size=480;
    chunk->header.bounds={32.02,118.78,31.98,118.82};chunk->header.session="chunk-session";
    auto paint=[](MapFrame& f,int split) {
        for(int y=0;y<480;++y)for(int x=0;x<480;++x) {
            const uint16_t color=x<split?0xf800:0x07e0;
            f.pixels.get()[(y*480+x)*2]=color&255;f.pixels.get()[(y*480+x)*2+1]=color>>8;
        }
    };
    paint(*chunk,240);assert(pages.SetImage(chunk));Advance(100);
    position.lat=32;position.lng=118.8;position.accuracy=8;position.seq=10;position.received_ms=1000;
    pages.SetPosition(position,1000);Advance(100);
    assert(framebuffer[300*466+200]==0xf800 && framebuffer[300*466+300]==0x07e0);
    assert(framebuffer[233*466+233]!=0x07e0); // centered blue point
    position.lng=118.805;position.seq=11;pages.SetPosition(position,2000);Advance(400);
    assert(framebuffer[300*466+200]==0x07e0 && framebuffer[300*466+50]==0xf800);
    assert(framebuffer[233*466+233]!=0x07e0); // moved map, centered point
    auto next=std::make_shared<MapFrame>(MapWire::kChunkBytes);next->header=chunk->header;
    next->header.bounds.west+=.005;next->header.bounds.east+=.005;paint(*next,180);
    std::weak_ptr<MapFrame> released=chunk;chunk.reset();assert(pages.SetImage(next));Advance(100);
    assert(released.expired()); // chunks use aligned atomic swap, no extra fading block
    assert(framebuffer[300*466+200]==0x07e0 && framebuffer[300*466+50]==0xf800);
    position.seq=12;pages.SetPosition(position,2000);Advance(400);
    assert(framebuffer[233*466+233]!=0x07e0);
    position.lng=118.824;position.seq=13;pages.SetPosition(position,3000);Advance(400);
    assert(framebuffer[233*466+233]==0x07e0); // edge: point moves off center, map never exposes a blank edge
    assert(framebuffer[300*466+1]==0x07e0 && framebuffer[300*466+464]==0x07e0);
    pages.SetPosition(position,16001);Advance(100);
    assert(framebuffer[233*466+443]==0x07e0); // stale marker cleared
    pages.ShowMap(false);Advance(300);pages.ShowMap(true);Advance(300);
    assert(pages.SetImage(green));Advance(100);
    assert(framebuffer[233*466+233]==0x07e0 && framebuffer[100*466+100]!=0x07e0);
    puts("PASS: P7-test07 actual LVGL chunk window scale, centered motion, aligned block replacement, storage lifetime, edge clamp, stale location and legacy image restore");

    // Independent route layer: crossing off-screen vertices, colour-only changes,
    // geographic alignment through window animation and a new cached map block.
    auto routeMap=std::make_shared<MapFrame>(MapWire::kChunkBytes);
    routeMap->header.geo=true;routeMap->header.chunk=true;routeMap->header.size=480;
    routeMap->header.bounds={32.02,118.78,31.98,118.82};routeMap->header.session="route-session";
    memset(routeMap->pixels.get(),0,MapWire::kChunkBytes);assert(pages.SetImage(routeMap));
    position.lat=32;position.lng=118.8;position.seq=20;position.received_ms=1000;pages.SetPosition(position,1000);Advance(400);
    auto route=std::make_shared<RouteWire::Frame>();route->active=true;route->revision=1;route->session="route-session";
    route->palette.route=0xff00ff;route->palette.destination=0xff0000;route->palette.position=0xffff00;
    route->points={{32.005,118.76},{32.005,118.84},{31.995,118.84},{31.995,118.76}};
    route->destination={32.005,118.805};pages.SetRoute(route);Advance(100);
    assert(framebuffer[116*466+100]==0xf81f && framebuffer[350*466+100]==0xf81f);
    assert(framebuffer[233*466+233]==0xffe0 && framebuffer[116*466+349]==0xf800);
    position.lng=118.805;position.seq=21;pages.SetPosition(position,1000);Advance(400);
    assert(framebuffer[116*466+233]==0xf800 && framebuffer[116*466+100]==0xf81f);
    auto map2=std::make_shared<MapFrame>(MapWire::kChunkBytes);map2->header=routeMap->header;
    map2->header.bounds.west+=.005;map2->header.bounds.east+=.005;memset(map2->pixels.get(),0,MapWire::kChunkBytes);
    assert(pages.SetImage(map2));Advance(100);
    assert(framebuffer[116*466+233]==0xf800 && framebuffer[116*466+100]==0xf81f);
    auto recolored=std::make_shared<RouteWire::Frame>(*route);recolored->revision=2;recolored->palette.route=0x00ffff;
    pages.SetRoute(recolored);Advance(100);assert(framebuffer[116*466+100]==0x07ff);
    auto cleared=std::make_shared<RouteWire::Frame>(*recolored);cleared->active=false;cleared->points.clear();
    pages.SetRoute(cleared);Advance(100);assert(framebuffer[116*466+100]==0 && framebuffer[116*466+233]==0);
    pages.SetRoute(route);Advance(100);assert(framebuffer[116*466+100]==0xf81f);
    map2->header.session="other-session";assert(pages.SetImage(map2));Advance(100);
    assert(framebuffer[116*466+100]==0 && framebuffer[116*466+233]==0);
    puts("PASS: P8-test01 actual LVGL off-screen crossing route, endpoint/location colours, animated window, aligned chunk swap, recolour without map replacement, clear and session isolation");

    // Progress is a segment index plus a fraction of the ORIGINAL unclipped segment.
    assert(pages.SetImage(routeMap));pages.SetRoute(nullptr);
    auto progressing=std::make_shared<RouteWire::Frame>(*route);progressing->revision=10;
    progressing->points={{32.005,118.76},{32.005,118.84}};progressing->palette.traveled=0x00ffff;
    pages.SetRoute(progressing);
    position.lng=118.8;position.lat=32;position.seq=30;position.route_revision=10;position.route_progress=.5;
    pages.SetPosition(position,1000);Advance(400);
    assert(framebuffer[116*466+100]==0x07ff && framebuffer[116*466+400]==0xf81f);
    position.route_progress=.54;position.seq=31;pages.SetPosition(position,1000);Advance(400);
    assert(framebuffer[116*466+285]==0x07ff && framebuffer[116*466+400]==0xf81f);
    position.route_progress=.1;position.seq=32;pages.SetPosition(position,1000);Advance(100);
    assert(framebuffer[116*466+285]==0x07ff); // backward GPS cannot erase walked prefix
    pages.SetPosition(position,17000);Advance(100);assert(framebuffer[116*466+285]==0x07ff); // GPS expiry preserves progress
    auto style=std::make_shared<RouteWire::Frame>(*progressing);style->revision=11;style->palette.traveled=0xffff00;
    pages.SetRoute(style);Advance(100);assert(framebuffer[116*466+285]==0xffe0);
    position.route_revision=10;position.route_progress=1;position.seq=33;pages.SetPosition(position,1000);Advance(100);
    assert(framebuffer[116*466+400]==0xf81f); // delayed previous-revision position ignored
    auto swapped=std::make_shared<MapFrame>(MapWire::kChunkBytes);swapped->header=routeMap->header;
    swapped->header.bounds.west+=.005;swapped->header.bounds.east+=.005;memset(swapped->pixels.get(),0,MapWire::kChunkBytes);
    assert(pages.SetImage(swapped));Advance(100);
    assert(framebuffer[116*466+285]==0xffe0 && framebuffer[116*466+400]==0xf81f);
    auto changed=std::make_shared<RouteWire::Frame>(*style);changed->revision=12;changed->points[0].lng-=.001;
    pages.SetRoute(changed);Advance(100);assert(framebuffer[116*466+100]==0xf81f); // new geometry resets progress
    position.route_revision=12;position.route_progress=.54;position.seq=34;
    pages.SetPosition(position,1000);Advance(100);assert(framebuffer[116*466+100]==0xffe0);
    auto replanned=std::make_shared<RouteWire::Frame>(*changed);replanned->revision=13;replanned->reset_progress=true;
    pages.SetRoute(replanned);Advance(100);assert(framebuffer[116*466+100]==0xf81f); // same geometry, genuinely new plan
    position.route_revision=13;position.route_progress=.54;position.seq=35;
    pages.SetPosition(position,1000);Advance(100);assert(framebuffer[116*466+100]==0xffe0);
    pages.SetRoute(std::make_shared<RouteWire::Frame>(*replanned));Advance(100);
    assert(framebuffer[116*466+100]==0xffe0); // same-revision retry cannot erase progress
    pages.SetRoute(nullptr);Advance(100);assert(framebuffer[116*466+100]==0);
    puts("PASS: P8-test02 actual LVGL progress split before clipping, no rollback, expiry retention, recolour, revision guard, map swap and route reset");

    SwipeTracker swipe;
    assert(swipe.Update(true,true,300,200,0)==0);
    assert(swipe.Update(true,true,220,205,80)==-1);
    assert(swipe.Update(true,true,100,205,160)==0); // one per contact
    swipe.Update(true,false,0,0,180);
    assert(swipe.Update(true,true,100,200,200)==0);
    assert(swipe.Update(true,true,200,200,300)==1);
    swipe.Update(true,false,0,0,310);
    swipe.Update(true,true,200,200,400);
    assert(swipe.Update(true,true,210,205,450)==0); // tap/short jitter
    assert(swipe.Update(true,true,230,330,500)==0); // vertical
    assert(swipe.Update(true,true,350,330,1700)==0); // too slow
    swipe.Update(true,false,0,0,1800);
    swipe.Update(true,true,300,200,1900);
    swipe.Update(false,true,200,200,1950);
    assert(swipe.Update(true,true,100,200,2000)==0); // I2C failure cancels contact
    swipe.Update(true,false,0,0,2010);
    swipe.Update(true,true,300,200,0xfffffff0u);
    assert(swipe.Update(true,true,200,200,40)==-1); // clock rollover
    puts("PASS: actual LVGL 100 page round trips/reversal/boundaries, RGB565 pixel colors, image replacement lifetime/cache; horizontal swipe, tap/vertical/slow/error rejection and one gesture per contact");
    lv_deinit();
}
