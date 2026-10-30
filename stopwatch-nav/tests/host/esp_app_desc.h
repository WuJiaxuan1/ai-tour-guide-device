#pragma once
struct esp_app_desc_t { const char* version = "2.2.6-p2-test01"; };
inline const esp_app_desc_t* esp_app_get_description() { static esp_app_desc_t desc; return &desc; }
