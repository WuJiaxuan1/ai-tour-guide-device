#pragma once
#include "esp_http_server.h"
#include <cassert>
using nvs_handle_t = int;
constexpr int NVS_READONLY = 0, NVS_READWRITE = 1, ESP_ERR_NVS_NOT_FOUND = 0x1102;
#define ESP_ERROR_CHECK(x) assert((x) == ESP_OK)
esp_err_t nvs_open(const char*, int, nvs_handle_t*);
esp_err_t nvs_get_str(nvs_handle_t, const char*, char*, size_t*);
esp_err_t nvs_set_str(nvs_handle_t, const char*, const char*);
esp_err_t nvs_erase_key(nvs_handle_t, const char*);
esp_err_t nvs_commit(nvs_handle_t);
void nvs_close(nvs_handle_t);
