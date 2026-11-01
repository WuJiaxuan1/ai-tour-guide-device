// Run the production HTTP handlers with real cJSON and a minimal IDF transport shim.
// This checks parser/state behavior, not the ESP32 socket implementation or radio.
#include "local_link_server.h"
#include <cJSON.h>
#include <algorithm>
#include <cassert>
#include <cstring>
#include <iostream>
#include <map>
#include <fstream>

static std::map<std::string, httpd_uri_t> routes;
static int starts = 0;
esp_err_t httpd_start(httpd_handle_t* handle, const httpd_config_t* config) {
    assert(config->server_port == 8765 && config->ctrl_port != 32768);
    assert(config->max_open_sockets <= 3 && config->task_priority <= 2);
    *handle = reinterpret_cast<void*>(1); ++starts; return ESP_OK;
}
esp_err_t httpd_stop(httpd_handle_t) { routes.clear(); return ESP_OK; }
esp_err_t httpd_register_uri_handler(httpd_handle_t, const httpd_uri_t* uri) { routes[uri->uri] = *uri; return ESP_OK; }
esp_err_t httpd_resp_set_type(httpd_req_t*, const char*) { return ESP_OK; }
esp_err_t httpd_resp_set_hdr(httpd_req_t*, const char*, const char*) { return ESP_OK; }
esp_err_t httpd_resp_set_status(httpd_req_t* req, const char* status) { req->status = status; return ESP_OK; }
esp_err_t httpd_resp_send(httpd_req_t* req, const char* data, int size) {
    req->response.assign(data, size < 0 ? strlen(data) : size); return ESP_OK;
}
esp_err_t httpd_req_get_hdr_value_str(httpd_req_t* req, const char*, char* dst, size_t size) {
    if (req->content_type.size() >= size) return ESP_FAIL;
    strcpy(dst, req->content_type.c_str()); return ESP_OK;
}
int httpd_req_recv(httpd_req_t* req, char* dst, size_t size) {
    if (req->fail_recv || req->cursor >= req->fail_after) return -1;
    if (req->on_recv) req->on_recv(req->cursor);
    auto count = std::min({size, req->chunk, req->body.size() - req->cursor});
    memcpy(dst, req->body.data() + req->cursor, count); req->cursor += count; return count;
}
static httpd_req_t Request(const std::string& path, const std::string& body = "", const std::string& content_type = "application/json", bool fail_recv = false) {
    auto route = routes.at(path);
    httpd_req_t req;
    req.content_len = body.size(); req.body = body; req.user_ctx = route.user_ctx;
    req.content_type = content_type; req.fail_recv = fail_recv;
    route.handler(&req);
    return req;
}
static double Number(const std::string& json, const char* name) {
    cJSON* root = cJSON_Parse(json.c_str()); assert(root);
    cJSON* value = cJSON_GetObjectItemCaseSensitive(root, name); assert(cJSON_IsNumber(value));
    double result = value->valuedouble; cJSON_Delete(root); return result;
}
static std::string String(const std::string& json, const char* name) {
    cJSON* root = cJSON_Parse(json.c_str()); assert(root);
    cJSON* value = cJSON_GetObjectItemCaseSensitive(root, name); assert(cJSON_IsString(value));
    std::string result(value->valuestring); cJSON_Delete(root); return result;
}
int main(int argc, char** argv) {
    int notifications = 0;
    LocalLinkServer server([&](uint32_t sequence, uint32_t count) {
        assert(sequence == 7 && count == 1); ++notifications;
    });
    assert(server.Start("192.168.43.123"));
    auto before = Request("/api/v1/status");
    assert(Number(before.response, "received_count") == 0);
    assert(String(before.response, "service") == "qixia-stopwatch");
    const std::string ping = R"({"protocol":1,"type":"ping","session":"0123456789abcdef0123456789abcdef","seq":7,"message":"maple"})";
    auto response = Request("/api/v1/echo", ping);
    assert(response.status == "200 OK" && notifications == 1);
    assert(String(response.response, "type") == "ack" && Number(response.response, "seq") == 7);
    assert(String(response.response, "session") == "0123456789abcdef0123456789abcdef");
    assert(String(response.response, "message") == "maple");
    int rejected = 0;
    auto reject = [&](const std::string& body, const std::string& status = "400", const std::string& content_type = "application/json", bool fail_recv = false) {
        auto result = Request("/api/v1/echo", body, content_type, fail_recv);
        assert(result.status.find(status) == 0); ++rejected;
        assert(Number(Request("/api/v1/status").response, "received_count") == 1);
    };
    reject("", "413");
    reject(std::string(385, 'x'), "413");
    reject("not JSON");
    reject("{\"nested\":" + std::string(100, '[') + "0" + std::string(100, ']') + "}");
    reject(ping + "garbage");
    reject(ping + std::string(1, '\0'));
    reject(ping, "415", "text/plain");
    reject(ping, "408", "application/json", true);
    for (const auto& replacement : {std::string("7.5"), std::string("-1"), std::string("2000000001"), std::string("\"7\"")}) {
        auto invalid = ping; invalid.replace(invalid.find("\"seq\":7") + 6, 1, replacement); reject(invalid);
    }
    auto wrong_protocol = ping; wrong_protocol.replace(wrong_protocol.find("\"protocol\":1") + 11, 1, "2"); reject(wrong_protocol);
    auto missing = ping; missing.replace(missing.find("\"session\""), 9, "\"missing\""); reject(missing);
    auto long_message = ping; long_message.replace(long_message.find("maple"), 5, std::string(97, 'x')); reject(long_message);
    assert(server.Start("192.168.43.123") && starts == 1);
    server.Stop();
    assert(server.Start("192.168.43.124") && starts == 2);
    auto after = Request("/api/v1/status");
    assert(Number(after.response, "received_count") == 1);
    assert(String(after.response, "boot_id") == String(before.response, "boot_id"));
    assert(String(after.response, "ip") == "192.168.43.124");
    // P6 image handling: keep an installed frame while malformed/incomplete
    // requests and page changes are rejected; one pending frame at a time.
    assert(MapWire::Crc32(reinterpret_cast<const uint8_t*>("123456789"), 9) == 0xcbf43926u);
    std::string frame(MapWire::kHeader + MapWire::kBytes, '\0');
    auto put32 = [&](size_t offset, uint32_t value) {
        for (int i=0; i<4; ++i) frame[offset+i] = (value >> (i*8)) & 255;
    };
    memcpy(frame.data(), "QMAP", 4); frame[4]=frame[5]=frame[6]=1;
    frame[8]=frame[10]=char(240); put32(12,17); put32(16,MapWire::kBytes);
    for (size_t i=MapWire::kHeader; i<frame.size(); i+=2) { frame[i]=0; frame[i+1]=char(0xf8); }
    put32(20,MapWire::Crc32(reinterpret_cast<const uint8_t*>(frame.data()+MapWire::kHeader),MapWire::kBytes));
    int image_notifications=0;
    server.OnImageReady([&]{ ++image_notifications; });
    auto imageRequest = [&](const std::string& bytes, size_t fail_after=size_t(-1), bool change_page=false) {
        auto route=routes.at("/api/v1/image"); httpd_req_t req;
        req.user_ctx=route.user_ctx; req.body=bytes; req.content_len=bytes.size();
        req.content_type="application/octet-stream"; req.chunk=997; req.fail_after=fail_after;
        if(change_page) req.on_recv=[&](size_t cursor) { if(cursor>1000) { server.Images().SetActive(false); server.Images().SetActive(true); } };
        route.handler(&req); return req;
    };
    assert(imageRequest(frame).status.find("409")==0);
    server.Images().SetActive(true);
    auto accepted=imageRequest(frame);
    assert(accepted.status=="200 OK" && image_notifications==1);
    assert(String(accepted.response,"state")=="queued");
    assert(Number(Request("/api/v1/status").response,"image_displayed_id")==0);
    assert(imageRequest(frame).status.find("409")==0); // pending slot bounded
    auto installed=server.Images().Take(); assert(installed && installed->header.id==17);
    server.Images().Displayed(*installed);
    auto assertUnchanged=[&] { assert(!server.Images().Take()); assert(server.Images().Status().displayed==17); assert(image_notifications==1); };
    auto corrupt=frame; corrupt.back()^=1;
    assert(imageRequest(corrupt).status.find("400")==0); assertUnchanged();
    assert(imageRequest(frame,2000).status.find("408")==0); assertUnchanged();
    assert(imageRequest(frame,size_t(-1),true).status.find("408")==0); assertUnchanged();
    for(size_t offset : {size_t(0),size_t(4),size_t(5),size_t(6),size_t(7),size_t(8),size_t(10),size_t(16),size_t(40)}) {
        auto invalid=frame; invalid[offset]^=2;
        assert(imageRequest(invalid).status.find("400")==0); assertUnchanged();
    }
    assert(imageRequest(frame.substr(0,100)).status.find("413")==0); assertUnchanged();
    // Invalidated queued image never appears after returning to map.
    assert(imageRequest(frame).status=="200 OK");
    server.Images().SetActive(false); server.Images().SetActive(true);
    assert(!server.Images().Take());
    assert(imageRequest(frame).status=="200 OK");
    server.Stop(); assert(!server.Images().Take());
    assert(server.Start("192.168.43.124"));
    assert(imageRequest(frame).status=="200 OK");
    assert(server.Images().Take());
    if(argc>=2) {
        std::ifstream input(argv[1],std::ios::binary);
        assert(input);
        std::string phone_frame((std::istreambuf_iterator<char>(input)),std::istreambuf_iterator<char>());
        auto result=imageRequest(phone_frame);
        assert(result.status=="200 OK");
        auto decoded=server.Images().Take();
        assert(decoded && decoded->header.id==23 && decoded->header.session=="0123456789abcdef0123456789abcdef");
        assert(MapWire::Read16(decoded->pixels.get())==0xf800);
        assert(MapWire::Read16(decoded->pixels.get()+2)==0x07e0);
        assert(MapWire::Read16(decoded->pixels.get()+4)==0x001f);
        std::cout << "PASS: actual Kotlin encoder binary accepted by production C++ HTTP handler, RGB565 red/green/blue and session/frame identity match\n";
    }
    if(argc>=3) {
        std::ifstream input(argv[2],std::ios::binary); assert(input);
        std::string phone((std::istreambuf_iterator<char>(input)),std::istreambuf_iterator<char>());
        assert(imageRequest(phone).status=="200 OK");
        auto geo=server.Images().Take(); assert(geo && geo->header.geo && geo->header.id==24);
        const auto b=geo->header.bounds;
        assert(std::abs(b.north-32.01)<1e-10 && std::abs(b.west-118.79)<1e-10);
        assert(MapWire::Read16(geo->pixels.get())==0xf800);
        server.Images().Displayed(*geo);
        assert(!server.Images().Position().valid);
        double x=0,y=0;
        assert(b.Project(32.005,118.795,x,y) && std::abs(x-120)<1e-6 && std::abs(y-120)<.1);
        assert(!b.Project(32.02,118.795,x,y));
        const std::string pos=R"({"protocol":1,"session":"0123456789abcdef0123456789abcdef","frame_id":24,"seq":1,"lat":32.005,"lng":118.795,"accuracy":8,"age_ms":1000,"valid":true})";
        auto position=Request("/api/v1/position",pos); assert(position.status=="200 OK");
        assert(String(position.response,"type")=="position_received");
        auto p=server.Images().Position(); assert(p.Fresh(1000) && p.Fresh(15000) && !p.Fresh(15001));
        assert(Request("/api/v1/position",pos).status.find("409")==0); // no replay
        auto change=[&](const std::string& from,const std::string& to){auto v=pos;v.replace(v.find(from),from.size(),to);return v;};
        assert(Request("/api/v1/position",change("\"frame_id\":24","\"frame_id\":23")).status.find("409")==0);
        assert(Request("/api/v1/position",change("0123456789abcdef0123456789abcdef","ffffffffffffffffffffffffffffffff")).status.find("409")==0);
        for(const auto& bad: {change("32.005","1e999"),change("\"seq\":1","\"seq\":1.5"),change("\"valid\":true","\"valid\":1"),change("\"age_ms\":1000","\"age_ms\":-1")})
            assert(Request("/api/v1/position",bad).status.find("400")==0);
        assert(Request("/api/v1/position",pos,"text/plain").status.find("415")==0);
        assert(Request("/api/v1/position",pos,"application/json",true).status.find("408")==0);
        auto invalid=change("\"seq\":1","\"seq\":2");invalid.replace(invalid.find("true"),4,"false");
        assert(Request("/api/v1/position",invalid).status=="200 OK");assert(!server.Images().Position().Fresh(1000));
        server.Images().SetActive(false);server.Images().SetActive(true);
        assert(Request("/api/v1/position",change("\"seq\":1","\"seq\":3")).status=="200 OK");
        server.Stop();assert(!server.Images().Position().valid);assert(server.Start("192.168.43.124"));
        for(size_t offset: {size_t(80),size_t(81)}) {auto bad=phone;bad[offset]^=3;assert(imageRequest(bad).status.find("400")==0);}
        auto bad=phone;memset(bad.data()+48,0,8);assert(imageRequest(bad).status.find("400")==0);
        assert(imageRequest(phone).status=="200 OK");
        geo=server.Images().Take();server.Images().Displayed(*geo);assert(!server.Images().Position().valid);
        std::cout<<"PASS: P7 Kotlin geo image accepted, GCJ bounds/projection, position identity/replay/expiry, invalid JSON, page/network invalidation and new-map marker reset\n";
    }
    if(argc>=4) {
        std::ifstream input(argv[3],std::ios::binary);assert(input);
        std::string chunk((std::istreambuf_iterator<char>(input)),std::istreambuf_iterator<char>());
        assert(Number(Request("/api/v1/status").response,"chunk_protocol")==1);
        assert(imageRequest(chunk).status=="200 OK");
        auto block=server.Images().Take();assert(block && block->header.chunk && block->header.size==480);
        assert(block->header.Bytes()==460800 && block->header.id==25);
        server.Images().Displayed(*block);
        double x=0,y=0;assert(block->header.bounds.Project(32,118.8,x,y,480));
        assert(std::abs(x-240)<.01 && std::abs(y-240)<.1);
        assert(MapWire::Window::At(x,y,480).x==120);
        assert(MapWire::Window::At(479,0,480).x==240 && MapWire::Window::At(479,0,480).y==0);
        for(size_t i: {size_t(4),size_t(8),size_t(10),size_t(16),size_t(81)}) {
            auto bad=chunk;bad[i]^=2;assert(imageRequest(bad).status.find("400")==0);
        }
        auto bad=chunk;bad.back()^=1;assert(imageRequest(bad).status.find("400")==0);
        assert(imageRequest(chunk,20000).status.find("408")==0);
        assert(imageRequest(chunk,size_t(-1),true).status.find("408")==0);
        assert(server.Images().Status().displayed==25 && !server.Images().Take());
        puts("PASS: P7-test07 Kotlin 480 chunk, bounded allocation, fragmented receive, CRC/truncation/page rejection and viewport geometry");
    }
    if(argc>=6) {
        auto read=[](const char* path){std::ifstream f(path,std::ios::binary);assert(f);return std::string((std::istreambuf_iterator<char>(f)),std::istreambuf_iterator<char>());};
        const auto wire=read(argv[4]),clear=read(argv[5]);
        auto send=[&](const std::string& data){return Request("/api/v1/route",data,"application/octet-stream");};
        auto seal=[](std::string& data) {uint32_t crc=RouteWire::Checksum(reinterpret_cast<const uint8_t*>(data.data()),data.size());for(int i=0;i<4;++i)data[20+i]=char(crc>>(i*8));};
        server.Images().SetActive(true);
        assert(Number(Request("/api/v1/status").response,"route_protocol")==1);
        assert(send(wire).status=="200 OK");assert(send(wire).status=="200 OK"); // idempotent retry
        auto route=server.Images().Route();assert(route && route->revision==7 && route->points.size()==2 && route->palette.route==0xff00ff);
        assert(std::abs(route->destination.lng-118.805)<1e-8);
        assert(Number(Request("/api/v1/status").response,"route_revision")==7);
        for(size_t at:{size_t(5),size_t(8),size_t(20),size_t(40),size_t(80)}) {auto bad=wire;bad[at]^=1;assert(send(bad).status.find("400")==0);}
        auto wrong=wire;wrong[24]^=1;seal(wrong);assert(send(wrong).status.find("409")==0);
        auto old=wire;old[8]=6;seal(old);assert(send(old).status.find("409")==0);
        auto conflict=wire;conflict[40]^=1;seal(conflict);assert(send(conflict).status.find("409")==0);
        for(size_t at:{size_t(7),size_t(43),size_t(61),size_t(62)}) {auto bad=wire;bad[at]=char(255);seal(bad);assert(send(bad).status.find("400")==0);}
        auto nan=wire;memset(nan.data()+64,255,8);seal(nan);assert(send(nan).status.find("400")==0);
        assert(send(wire.substr(0,wire.size()-1)).status.find("400")==0);
        assert(send(std::string(RouteWire::kMaxBytes+1,'x')).status.find("413")==0);
        assert(Request("/api/v1/route",wire,"text/plain").status.find("415")==0);
        assert(Request("/api/v1/route",wire,"application/octet-stream",true).status.find("408")==0);
        assert(server.Images().Route()==route); // all rejected requests preserve installed overlay
        auto handler=routes.at("/api/v1/route");httpd_req_t interrupted;
        interrupted.body=wire;interrupted.content_len=wire.size();interrupted.content_type="application/octet-stream";interrupted.user_ctx=handler.user_ctx;
        interrupted.on_recv=[&](size_t){server.Images().SetActive(false);server.Images().SetActive(true);};
        handler.handler(&interrupted);assert(interrupted.status!="200 OK" && !server.Images().Route());
        assert(send(wire).status=="200 OK");
        MapFrame next;next.header.geo=true;next.header.session=route->session;next.header.id=26;
        server.Images().Displayed(next);assert(server.Images().Route()); // same session map swaps preserve route
        assert(Number(Request("/api/v1/status").response,"route_progress_protocol")==1);
        const std::string progress=R"({"protocol":1,"session":"0123456789abcdef0123456789abcdef","frame_id":26,"seq":1,"lat":32.005,"lng":118.805,"accuracy":8,"age_ms":0,"valid":true,"route_revision":7,"route_progress":0.375})";
        auto progressAck=Request("/api/v1/position",progress);assert(progressAck.status=="200 OK");
        assert(Number(progressAck.response,"route_revision")==7 && Number(progressAck.response,"route_progress")==.375);
        assert(server.Images().Position().route_progress==.375);
        auto altered=[&](const std::string& from,const std::string& to){auto data=progress;data.replace(data.find("\"seq\":1"),7,"\"seq\":2");data.replace(data.find(from),from.size(),to);return data;};
        for(const auto& value:{"-0.1","1e999","\"half\""}) assert(Request("/api/v1/position",altered("0.375",value)).status.find("400")==0);
        assert(Request("/api/v1/position",altered("route_revision", "wrong_revision")).status.find("400")==0);
        assert(Request("/api/v1/position",altered("\"route_revision\":7", "\"route_revision\":6")).status.find("409")==0);
        assert(Request("/api/v1/position",altered("0.375","1.1")).status.find("409")==0); // two-point route ends at cursor 1
        assert(server.Images().Position().route_progress==.375);
        assert(send(clear).status=="200 OK");assert(!server.Images().Route()->active && server.Images().Route()->points.empty());
        assert(Request("/api/v1/position",altered("0.375","0.5")).status.find("409")==0);
        assert(server.Images().Route()->palette.position==0xffff00);
        assert(send(wire).status.find("409")==0); // delayed pre-clear route cannot return
        auto reset=wire;reset[8]=9;reset[62]=1;seal(reset);
        assert(send(reset).status=="200 OK" && server.Images().Route()->reset_progress);
        assert(send(reset).status=="200 OK"); // retry preserves reset flag and payload identity
        for(size_t at:{size_t(62),size_t(63)}) {
            auto unknown=reset;unknown[8]=10;unknown[at]=2;seal(unknown);
            assert(send(unknown).status.find("400")==0);
        }
        next.header.session="ffffffffffffffffffffffffffffffff";server.Images().Displayed(next);
        assert(!server.Images().Route() && send(wire).status.find("409")==0);
        puts("PASS: P8-test01 real Kotlin route/clear, bounded parser, metadata/payload CRC, retries/revision/session, rejected upload preserves route, page cancellation and map-session lifecycle");
        puts("PASS: P8-test02 position carries acknowledged progress, revision/bounds/finite validation and cancelled-route rejection");
    }
    std::cout << "PASS: P6 real HTTP image receive/CRC, fragmented upload, voice-page rejection, pending-slot bound, invalid headers, corruption, truncation, page epoch and reconnect recovery; old displayed frame preserved\n";
    std::cout << "PASS: real firmware handlers, fragmented valid echo, " << rejected
              << " rejection cases, unchanged counters on rejection, and restart lifecycle\n";
}
