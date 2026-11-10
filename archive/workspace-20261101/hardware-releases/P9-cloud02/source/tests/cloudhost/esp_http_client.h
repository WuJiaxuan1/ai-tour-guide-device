#pragma once
#include <string>
#include <deque>
#include <vector>
#include <functional>
#include <algorithm>
#include <cstring>
#include <cassert>
#define ESP_OK 0
#define HTTP_METHOD_POST 1
struct esp_http_client_config_t {const char* url;int timeout_ms;int(*crt_bundle_attach)(void*);bool disable_auto_redirect;int buffer_size,buffer_size_tx;};
struct FakeResponse {std::string body;int code=200;bool chunked=true;};
struct FakeRequest {std::string url,token;FakeResponse response;size_t at=0;};
inline std::deque<FakeResponse> responses;
inline std::vector<FakeRequest> requests;
inline std::function<void()> during_open;
using esp_http_client_handle_t=FakeRequest*;
inline auto esp_http_client_init(esp_http_client_config_t* c){assert(c->crt_bundle_attach&&c->disable_auto_redirect);return new FakeRequest{c->url,"",{},0};}
inline void esp_http_client_cleanup(FakeRequest* h){delete h;}
inline void esp_http_client_set_header(FakeRequest* h,const char* k,const char* v){if(std::string(k)=="Authorization")h->token=v;}
inline void esp_http_client_set_method(FakeRequest*,int){}
inline int esp_http_client_open(FakeRequest* h,size_t){assert(!responses.empty());h->response=responses.front();responses.pop_front();requests.push_back(*h);if(during_open){auto fn=std::move(during_open);during_open=nullptr;fn();}return 0;}
inline int esp_http_client_write(FakeRequest*,const char*,size_t n){return n;}
inline int esp_http_client_fetch_headers(FakeRequest* h){return h->response.chunked?0:int(h->response.body.size());}
inline int esp_http_client_get_status_code(FakeRequest* h){return h->response.code;}
inline int64_t esp_http_client_get_content_length(FakeRequest* h){return h->response.chunked?-1:int64_t(h->response.body.size());}
inline bool esp_http_client_is_complete_data_received(FakeRequest* h){return h->at==h->response.body.size();}
inline int esp_http_client_read(FakeRequest* h,char* b,size_t n){n=std::min({n,size_t(17),h->response.body.size()-h->at});memcpy(b,h->response.body.data()+h->at,n);h->at+=n;return n;}
