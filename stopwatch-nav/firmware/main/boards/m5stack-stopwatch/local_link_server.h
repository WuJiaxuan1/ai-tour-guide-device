#pragma once

#include <esp_http_server.h>
#include <cstdint>
#include <functional>
#include <string>
#include "map_frame.h"
#ifdef ESP_PLATFORM
#include "cloud_navigation.h"
#endif

// P2 LAN diagnostics. Lifecycle runs on Application's main task; HTTP handlers
// run on the HTTP server task. No audio/UI calls are made from an HTTP handler.
class LocalLinkServer {
public:
    using ReceivedCallback = std::function<void(uint32_t, uint32_t)>;
    explicit LocalLinkServer(ReceivedCallback received);
    ~LocalLinkServer();
    bool Start(const std::string& ip);
    void Stop();
#ifdef ESP_PLATFORM
    std::string PairingCode() { return cloud_ ? cloud_->PairingCode() : R"({"status":"offline","instruction":"请先连接网络。"})"; }
#endif
    MapFrameMailbox& Images() { return images_; }
    void OnImageReady(std::function<void()> callback) { image_ready_ = std::move(callback); }

private:
    httpd_handle_t server_ = nullptr;
    std::string ip_;
    std::string boot_id_;
    uint32_t received_count_ = 0;
    uint32_t last_seq_ = 0;
    ReceivedCallback received_;
    MapFrameMailbox images_;
    std::function<void()> image_ready_;
#ifdef ESP_PLATFORM
    std::unique_ptr<CloudNavigation> cloud_;
    static esp_err_t CloudHandler(httpd_req_t* req);
#endif
    static esp_err_t StatusHandler(httpd_req_t* req);
    static esp_err_t EchoHandler(httpd_req_t* req);
    static esp_err_t ImageHandler(httpd_req_t* req);
    static esp_err_t PositionHandler(httpd_req_t* req);
    static esp_err_t RouteHandler(httpd_req_t* req);
};
