#pragma once
#include <cstddef>
#include <string>
#include <functional>
using esp_err_t = int;
using httpd_handle_t = void*;
constexpr int ESP_OK = 0, ESP_FAIL = -1, ESP_ERR_NO_MEM = 0x101;
constexpr int HTTP_GET = 0, HTTP_POST = 1, HTTPD_RESP_USE_STRLEN = -1;
struct httpd_config_t {
    int server_port = 80, ctrl_port = 32768, task_priority = 5, stack_size = 4096;
    int max_open_sockets = 7, max_uri_handlers = 8, recv_wait_timeout = 5, send_wait_timeout = 5;
    bool lru_purge_enable = false;
};
#define HTTPD_DEFAULT_CONFIG() {}
struct httpd_req_t {
    size_t content_len = 0;
    void* user_ctx = nullptr;
    std::string body, response, status = "200 OK", content_type = "application/json";
    size_t cursor = 0, chunk = 5;
    bool fail_recv = false;
    size_t fail_after = size_t(-1);
    std::function<void(size_t)> on_recv;
};
struct httpd_uri_t {
    const char* uri = nullptr;
    int method = 0;
    esp_err_t (*handler)(httpd_req_t*) = nullptr;
    void* user_ctx = nullptr;
};
esp_err_t httpd_start(httpd_handle_t*, const httpd_config_t*);
esp_err_t httpd_stop(httpd_handle_t);
esp_err_t httpd_register_uri_handler(httpd_handle_t, const httpd_uri_t*);
esp_err_t httpd_resp_set_type(httpd_req_t*, const char*);
esp_err_t httpd_resp_set_hdr(httpd_req_t*, const char*, const char*);
esp_err_t httpd_resp_set_status(httpd_req_t*, const char*);
esp_err_t httpd_resp_send(httpd_req_t*, const char*, int);
esp_err_t httpd_req_get_hdr_value_str(httpd_req_t*, const char*, char*, size_t);
int httpd_req_recv(httpd_req_t*, char*, size_t);
inline const char* esp_err_to_name(int) { return "test error"; }
