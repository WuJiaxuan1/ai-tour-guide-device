#pragma once

#include <esp_http_server.h>
#include <cstdint>
#include <functional>
#include <string>

// P2 LAN diagnostics. Lifecycle runs on Application's main task; HTTP handlers
// run on the HTTP server task. No audio/UI calls are made from an HTTP handler.
class LocalLinkServer {
public:
    using ReceivedCallback = std::function<void(uint32_t, uint32_t)>;
    explicit LocalLinkServer(ReceivedCallback received);
    ~LocalLinkServer();
    bool Start(const std::string& ip);
    void Stop();

private:
    httpd_handle_t server_ = nullptr;
    std::string ip_;
    std::string boot_id_;
    uint32_t received_count_ = 0;
    uint32_t last_seq_ = 0;
    ReceivedCallback received_;
    static esp_err_t StatusHandler(httpd_req_t* req);
    static esp_err_t EchoHandler(httpd_req_t* req);
};
