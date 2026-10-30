#include "local_link_server.h"

#include <cJSON.h>
#include <esp_app_desc.h>
#include <esp_log.h>
#include <esp_random.h>
#include <esp_timer.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>
#include <utility>
#include <algorithm>

namespace {
constexpr char kTag[] = "LocalLink";
constexpr size_t kMaxBody = 384;
using Json = std::unique_ptr<cJSON, decltype(&cJSON_Delete)>;

esp_err_t SendJson(httpd_req_t* req, cJSON* body) {
    char* text = cJSON_PrintUnformatted(body);
    if (!text) return ESP_ERR_NO_MEM;
    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    httpd_resp_set_hdr(req, "Connection", "close");
    auto result = httpd_resp_send(req, text, HTTPD_RESP_USE_STRLEN);
    cJSON_free(text);
    return result;
}

esp_err_t Reject(httpd_req_t* req, const char* status, const char* reason) {
    httpd_resp_set_status(req, status);
    Json error(cJSON_CreateObject(), cJSON_Delete);
    if (error) {
        cJSON_AddStringToObject(error.get(), "error", reason);
        SendJson(req, error.get());
    }
    // Close requests with unread/invalid bodies instead of reusing their socket.
    return ESP_FAIL;
}

bool IsSession(const cJSON* item) {
    if (!cJSON_IsString(item) || strlen(item->valuestring) != 32) return false;
    for (const char* p = item->valuestring; *p; ++p) {
        if (!(*p >= '0' && *p <= '9') && !(*p >= 'a' && *p <= 'f')) return false;
    }
    return true;
}

bool IsFlatJson(const char* data, size_t length) {
    // The P2 schema has scalar fields only. Bound parser recursion before cJSON
    // sees a body, even when a short body contains many nested containers.
    bool quoted = false, escaped = false;
    int depth = 0;
    for (size_t i = 0; i < length; ++i) {
        const char c = data[i];
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') quoted = true;
        else if (c == '[' || c == ']') return false;
        else if (c == '{' && ++depth > 1) return false;
        else if (c == '}' && --depth < 0) return false;
    }
    return !quoted && depth == 0;
}
}  // namespace

LocalLinkServer::LocalLinkServer(ReceivedCallback received) : received_(std::move(received)) {
    char id[17];
    snprintf(id, sizeof(id), "%08lx%08lx", static_cast<unsigned long>(esp_random()),
             static_cast<unsigned long>(esp_random()));
    boot_id_ = id;
}

LocalLinkServer::~LocalLinkServer() { Stop(); }

bool LocalLinkServer::Start(const std::string& ip) {
    if (server_ && ip == ip_) return true;
    Stop();
    ip_ = ip;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 8765;
    config.ctrl_port = 8766;  // Separate from the provisioning server's control port.
    config.task_priority = 2;
    config.stack_size = 6144;
    config.max_open_sockets = 3;
    config.max_uri_handlers = 5;
    config.lru_purge_enable = true;
    config.recv_wait_timeout = 2;
    config.send_wait_timeout = 2;
    auto result = httpd_start(&server_, &config);
    if (result != ESP_OK) {
        server_ = nullptr;
        ESP_LOGE(kTag, "Server start failed: %s", esp_err_to_name(result));
        return false;
    }
    httpd_uri_t status{};
    status.uri = "/api/v1/status";
    status.method = HTTP_GET;
    status.handler = StatusHandler;
    status.user_ctx = this;
    httpd_uri_t echo{};
    echo.uri = "/api/v1/echo";
    echo.method = HTTP_POST;
    echo.handler = EchoHandler;
    echo.user_ctx = this;
    httpd_uri_t image{};
    image.uri = "/api/v1/image";
    image.method = HTTP_POST;
    image.handler = ImageHandler;
    image.user_ctx = this;
    httpd_uri_t position{};
    position.uri = "/api/v1/position";
    position.method = HTTP_POST;
    position.handler = PositionHandler;
    position.user_ctx = this;
    httpd_uri_t route{};
    route.uri="/api/v1/route";route.method=HTTP_POST;route.handler=RouteHandler;route.user_ctx=this;
    if (httpd_register_uri_handler(server_, &status) != ESP_OK ||
        httpd_register_uri_handler(server_, &echo) != ESP_OK ||
        httpd_register_uri_handler(server_, &image) != ESP_OK ||
        httpd_register_uri_handler(server_, &position) != ESP_OK ||
        httpd_register_uri_handler(server_, &route) != ESP_OK) {
        Stop();
        return false;
    }
    ESP_LOGI(kTag, "P2 ready at http://%s:8765/api/v1/status", ip_.c_str());
    return true;
}

void LocalLinkServer::Stop() {
    images_.Invalidate();
    if (server_) {
        httpd_stop(server_);
        server_ = nullptr;
    }
}

esp_err_t LocalLinkServer::StatusHandler(httpd_req_t* req) {
    auto* self = static_cast<LocalLinkServer*>(req->user_ctx);
    Json body(cJSON_CreateObject(), cJSON_Delete);
    if (!body) return ESP_ERR_NO_MEM;
    cJSON_AddStringToObject(body.get(), "service", "qixia-stopwatch");
    cJSON_AddNumberToObject(body.get(), "protocol", 1);
    cJSON_AddStringToObject(body.get(), "firmware", esp_app_get_description()->version);
    cJSON_AddStringToObject(body.get(), "boot_id", self->boot_id_.c_str());
    cJSON_AddStringToObject(body.get(), "ip", self->ip_.c_str());
    cJSON_AddNumberToObject(body.get(), "received_count", self->received_count_);
    cJSON_AddNumberToObject(body.get(), "last_seq", self->last_seq_);
    cJSON_AddNumberToObject(body.get(), "uptime_ms", esp_timer_get_time() / 1000);
    const auto image = self->images_.Status();
    cJSON_AddNumberToObject(body.get(), "image_protocol", 1);
    cJSON_AddNumberToObject(body.get(), "geo_protocol", 1);
    cJSON_AddNumberToObject(body.get(), "chunk_protocol", 1);
    cJSON_AddNumberToObject(body.get(), "chunk_size", MapWire::kChunkSize);
    cJSON_AddBoolToObject(body.get(), "map_active", image.active);
    cJSON_AddBoolToObject(body.get(), "image_pending", image.pending);
    cJSON_AddNumberToObject(body.get(), "image_received_id", image.received);
    cJSON_AddNumberToObject(body.get(), "image_displayed_id", image.displayed);
    cJSON_AddStringToObject(body.get(), "image_session", image.session.c_str());
    const auto route=self->images_.Route();
    cJSON_AddNumberToObject(body.get(),"route_protocol",1);
    cJSON_AddNumberToObject(body.get(),"route_progress_protocol",1);
    cJSON_AddNumberToObject(body.get(),"route_max_points",RouteWire::kMaxPoints);
    cJSON_AddNumberToObject(body.get(),"route_revision",route?route->revision:0);
    cJSON_AddStringToObject(body.get(),"route_session",route?route->session.c_str():"");
    return SendJson(req, body.get());
}

esp_err_t LocalLinkServer::ImageHandler(httpd_req_t* req) {
    auto* self = static_cast<LocalLinkServer*>(req->user_ctx);
    if (req->content_len != MapWire::kHeader + MapWire::kBytes && req->content_len != MapWire::kGeoHeader + MapWire::kBytes &&
        req->content_len != MapWire::kGeoHeader + MapWire::kChunkBytes)
        return Reject(req, "413 Payload Too Large", "240 image or 480 chunk required");
    char type[48]{};
    if (httpd_req_get_hdr_value_str(req, "Content-Type", type, sizeof(type)) != ESP_OK || strcmp(type, "application/octet-stream"))
        return Reject(req, "415 Unsupported Media Type", "application/octet-stream required");
    uint32_t ticket = 0;
    if (!self->images_.Begin(ticket)) return Reject(req, "409 Conflict", "open map page and wait for pending image");
    const auto deadline = esp_timer_get_time() + 8000000;
    auto receive = [&](uint8_t* data, size_t size) {
        size_t offset = 0;
        while (offset < size) {
            if (esp_timer_get_time() > deadline || !self->images_.Current(ticket)) return false;
            const auto chunk = std::min(size - offset, size_t(4096));
            int count = httpd_req_recv(req, reinterpret_cast<char*>(data + offset), chunk);
            if (count <= 0) return false;
            offset += count;
        }
        return true;
    };
    uint8_t header[MapWire::kGeoHeader]{};
    const auto header_size = req->content_len == MapWire::kHeader + MapWire::kBytes ? MapWire::kHeader : MapWire::kGeoHeader;
    if (!receive(header, header_size)) return Reject(req, "408 Request Timeout", "incomplete header or page changed");
    MapWire::Header parsed;
    if (!MapWire::Parse(header, req->content_len, parsed)) return Reject(req, "400 Bad Request", "invalid image header");
    auto frame = std::make_shared<MapFrame>(parsed.Bytes());
    if (!frame->pixels) return Reject(req, "503 Service Unavailable", "image memory unavailable");
    frame->header = parsed;
    if (!receive(frame->pixels.get(), parsed.Bytes())) return Reject(req, "408 Request Timeout", "incomplete image or page changed");
    if (MapWire::Crc32(frame->pixels.get(), parsed.Bytes()) != parsed.crc)
        return Reject(req, "400 Bad Request", "image checksum mismatch");
    Json reply(cJSON_CreateObject(), cJSON_Delete);
    if (!reply) return ESP_ERR_NO_MEM;
    if (!self->images_.Commit(frame, ticket)) return Reject(req, "409 Conflict", "page changed or image pending");
    cJSON_AddStringToObject(reply.get(), "service", "qixia-stopwatch");
    cJSON_AddNumberToObject(reply.get(), "protocol", 1);
    cJSON_AddStringToObject(reply.get(), "type", "image_received");
    cJSON_AddStringToObject(reply.get(), "state", "queued");
    cJSON_AddStringToObject(reply.get(), "boot_id", self->boot_id_.c_str());
    cJSON_AddStringToObject(reply.get(), "session", parsed.session.c_str());
    cJSON_AddNumberToObject(reply.get(), "frame_id", parsed.id);
    cJSON_AddNumberToObject(reply.get(), "crc32", parsed.crc);
    if (self->image_ready_) self->image_ready_();
    return SendJson(req, reply.get());
}

esp_err_t LocalLinkServer::RouteHandler(httpd_req_t* req) {
    if(req->content_len<RouteWire::kHeader || req->content_len>RouteWire::kMaxBytes)
        return Reject(req,"413 Payload Too Large","bounded route required");
    char type[48]{};
    if(httpd_req_get_hdr_value_str(req,"Content-Type",type,sizeof(type))!=ESP_OK || strcmp(type,"application/octet-stream"))
        return Reject(req,"415 Unsupported Media Type","application/octet-stream required");
    auto* self=static_cast<LocalLinkServer*>(req->user_ctx);uint32_t ticket=0;
    if(!self->images_.Begin(ticket)) return Reject(req,"409 Conflict","map inactive or pending");
    auto bytes=std::unique_ptr<uint8_t,decltype(&std::free)>(static_cast<uint8_t*>(std::malloc(req->content_len)),std::free);
    if(!bytes) return Reject(req,"503 Service Unavailable","route memory unavailable");
    size_t offset=0;const auto deadline=esp_timer_get_time()+5000000;
    while(offset<req->content_len) {
        if(esp_timer_get_time()>deadline || !self->images_.Current(ticket)) return Reject(req,"408 Request Timeout","route expired");
        const int n=httpd_req_recv(req,reinterpret_cast<char*>(bytes.get()+offset),std::min(size_t(req->content_len)-offset,size_t(4096)));
        if(n<=0) return Reject(req,"408 Request Timeout","incomplete route");
        offset+=n;
    }
    auto route=std::make_shared<RouteWire::Frame>();
    if(!RouteWire::Parse(bytes.get(),offset,*route)) return Reject(req,"400 Bad Request","invalid route");
    Json reply(cJSON_CreateObject(),cJSON_Delete);if(!reply) return ESP_ERR_NO_MEM;
    if(!self->images_.SetRoute(route,ticket)) return Reject(req,"409 Conflict","route session/page/revision mismatch");
    cJSON_AddStringToObject(reply.get(),"service","qixia-stopwatch");cJSON_AddNumberToObject(reply.get(),"protocol",1);
    cJSON_AddStringToObject(reply.get(),"type","route_received");cJSON_AddStringToObject(reply.get(),"boot_id",self->boot_id_.c_str());
    cJSON_AddStringToObject(reply.get(),"session",route->session.c_str());cJSON_AddNumberToObject(reply.get(),"revision",route->revision);
    cJSON_AddNumberToObject(reply.get(),"crc32",route->crc);
    if(self->image_ready_) self->image_ready_();
    return SendJson(req,reply.get());
}

esp_err_t LocalLinkServer::PositionHandler(httpd_req_t* req) {
    if (!req->content_len || req->content_len > kMaxBody) return Reject(req,"413 Payload Too Large","position body too large");
    char type[48]{};
    if(httpd_req_get_hdr_value_str(req,"Content-Type",type,sizeof(type)) != ESP_OK ||
       (strcmp(type,"application/json") && strcmp(type,"application/json; charset=utf-8")))
        return Reject(req,"415 Unsupported Media Type","application/json required");
    char buffer[kMaxBody+1]{}; size_t offset=0;
    const auto deadline=esp_timer_get_time()+3000000;
    while(offset<req->content_len) {
        if(esp_timer_get_time()>deadline) return Reject(req,"408 Request Timeout","position timeout");
        const int n=httpd_req_recv(req,buffer+offset,req->content_len-offset);
        if(n<=0) return Reject(req,"408 Request Timeout","incomplete position");
        offset+=n;
    }
    if(memchr(buffer,0,offset) || !IsFlatJson(buffer,offset)) return Reject(req,"400 Bad Request","invalid position JSON");
    Json input(cJSON_ParseWithLengthOpts(buffer,offset+1,nullptr,true),cJSON_Delete);
    if(!input || !cJSON_IsObject(input.get())) return Reject(req,"400 Bad Request","invalid position JSON");
    auto item=[&](const char* key){return cJSON_GetObjectItemCaseSensitive(input.get(),key);};
    auto number=[&](const char* key,double low,double high,bool integer=false){auto* v=item(key);return cJSON_IsNumber(v) && std::isfinite(v->valuedouble) && v->valuedouble>=low && v->valuedouble<=high && (!integer || std::floor(v->valuedouble)==v->valuedouble);};
    if(!number("protocol",1,1) || !IsSession(item("session")) || !number("frame_id",1,2000000000,true) ||
       !number("seq",1,2000000000,true) || !cJSON_IsBool(item("valid")) ||
       !number("age_ms",0,3600000,true) || !number("lat",-85,85) || !number("lng",-180,180) || !number("accuracy",0,100000))
        return Reject(req,"400 Bad Request","invalid position fields");
    MapWire::Position position;
    if(item("route_revision") || item("route_progress")) {
        if(!number("route_revision",1,2000000000,true) || !number("route_progress",0,RouteWire::kMaxPoints-1))
            return Reject(req,"400 Bad Request","invalid route progress fields");
        position.route_revision=uint32_t(item("route_revision")->valuedouble);
        position.route_progress=item("route_progress")->valuedouble;
    }
    position.valid=cJSON_IsTrue(item("valid")); position.seq=uint32_t(item("seq")->valuedouble);
    position.age_ms=uint32_t(item("age_ms")->valuedouble); position.lat=item("lat")->valuedouble;
    position.lng=item("lng")->valuedouble; position.accuracy=item("accuracy")->valuedouble;
    position.received_ms=esp_timer_get_time()/1000;
    auto* self=static_cast<LocalLinkServer*>(req->user_ctx);
    const auto id=uint32_t(item("frame_id")->valuedouble);
    const std::string session=item("session")->valuestring;
    Json reply(cJSON_CreateObject(),cJSON_Delete);
    if(!reply) return ESP_ERR_NO_MEM;
    if(!self->images_.SetPosition(id,session,position)) return Reject(req,"409 Conflict","map/session/page/sequence changed");
    cJSON_AddStringToObject(reply.get(),"service","qixia-stopwatch");
    cJSON_AddNumberToObject(reply.get(),"protocol",1);
    cJSON_AddStringToObject(reply.get(),"type","position_received");
    cJSON_AddStringToObject(reply.get(),"boot_id",self->boot_id_.c_str());
    cJSON_AddStringToObject(reply.get(),"session",session.c_str());
    cJSON_AddNumberToObject(reply.get(),"frame_id",id);
    cJSON_AddNumberToObject(reply.get(),"seq",position.seq);
    if(position.route_revision) {
        cJSON_AddNumberToObject(reply.get(),"route_revision",position.route_revision);
        cJSON_AddNumberToObject(reply.get(),"route_progress",position.route_progress);
    }
    return SendJson(req,reply.get());
}

esp_err_t LocalLinkServer::EchoHandler(httpd_req_t* req) {
    if (req->content_len == 0 || req->content_len > kMaxBody) {
        return Reject(req, "413 Payload Too Large", "body must be 1..384 bytes");
    }
    char content_type[48]{};
    if (httpd_req_get_hdr_value_str(req, "Content-Type", content_type, sizeof(content_type)) != ESP_OK ||
        (strcmp(content_type, "application/json") != 0 &&
         strcmp(content_type, "application/json; charset=utf-8") != 0)) {
        return Reject(req, "415 Unsupported Media Type", "application/json required");
    }
    char buffer[kMaxBody + 1]{};
    size_t offset = 0;
    const auto deadline = esp_timer_get_time() + 3000000;
    while (offset < req->content_len) {
        if (esp_timer_get_time() > deadline) return Reject(req, "408 Request Timeout", "body timeout");
        int count = httpd_req_recv(req, buffer + offset, req->content_len - offset);
        if (count <= 0) return Reject(req, "408 Request Timeout", "incomplete body");
        offset += count;
    }
    if (memchr(buffer, '\0', offset)) return Reject(req, "400 Bad Request", "invalid JSON bytes");
    if (!IsFlatJson(buffer, offset)) return Reject(req, "400 Bad Request", "flat JSON object required");
    Json input(cJSON_ParseWithLengthOpts(buffer, offset + 1, nullptr, true), cJSON_Delete);
    if (!input || !cJSON_IsObject(input.get())) return Reject(req, "400 Bad Request", "invalid JSON");
    auto* protocol = cJSON_GetObjectItemCaseSensitive(input.get(), "protocol");
    auto* type = cJSON_GetObjectItemCaseSensitive(input.get(), "type");
    auto* sequence = cJSON_GetObjectItemCaseSensitive(input.get(), "seq");
    auto* session = cJSON_GetObjectItemCaseSensitive(input.get(), "session");
    auto* message = cJSON_GetObjectItemCaseSensitive(input.get(), "message");
    if (!cJSON_IsNumber(protocol) || protocol->valuedouble != 1 ||
        !cJSON_IsString(type) || strcmp(type->valuestring, "ping") != 0 ||
        !cJSON_IsNumber(sequence) || !std::isfinite(sequence->valuedouble) ||
        sequence->valuedouble < 1 || sequence->valuedouble > 2000000000 ||
        floor(sequence->valuedouble) != sequence->valuedouble || !IsSession(session) ||
        !cJSON_IsString(message) || strlen(message->valuestring) > 96) {
        return Reject(req, "400 Bad Request", "invalid ping fields");
    }
    auto* self = static_cast<LocalLinkServer*>(req->user_ctx);
    Json reply(cJSON_CreateObject(), cJSON_Delete);
    if (!reply) return ESP_ERR_NO_MEM;
    self->last_seq_ = static_cast<uint32_t>(sequence->valuedouble);
    ++self->received_count_;
    cJSON_AddStringToObject(reply.get(), "service", "qixia-stopwatch");
    cJSON_AddNumberToObject(reply.get(), "protocol", 1);
    cJSON_AddStringToObject(reply.get(), "type", "ack");
    cJSON_AddStringToObject(reply.get(), "boot_id", self->boot_id_.c_str());
    cJSON_AddStringToObject(reply.get(), "session", session->valuestring);
    cJSON_AddNumberToObject(reply.get(), "seq", self->last_seq_);
    cJSON_AddStringToObject(reply.get(), "message", message->valuestring);
    cJSON_AddNumberToObject(reply.get(), "received_count", self->received_count_);
    cJSON_AddNumberToObject(reply.get(), "uptime_ms", esp_timer_get_time() / 1000);
    ESP_LOGI(kTag, "RX seq=%lu total=%lu", static_cast<unsigned long>(self->last_seq_),
             static_cast<unsigned long>(self->received_count_));
    if (self->received_) self->received_(self->last_seq_, self->received_count_);
    return SendJson(req, reply.get());
}
