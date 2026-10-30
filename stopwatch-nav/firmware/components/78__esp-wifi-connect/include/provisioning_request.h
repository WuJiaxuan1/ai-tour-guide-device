#pragma once
#include <cJSON.h>
#include <cstring>
#include <memory>
#include <string>

namespace stopwatch_provisioning {
struct Credentials { std::string ssid; std::string password; };
inline constexpr const char* kSavedResponse = R"({"success":true,"saved":true,"connected":false})";

// Provisioning only stores scalar fields; reject nesting before recursive JSON parsing.
inline bool Parse(const char* body, size_t length, Credentials& output, std::string& error) {
    if (!body || length == 0 || length > 1024 || memchr(body, '\0', length)) {
        error = "Invalid request size or bytes"; return false;
    }
    bool quoted = false, escaped = false;
    int depth = 0;
    for (size_t i = 0; i < length; ++i) {
        char c = body[i];
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') quoted = true;
        else if (c == '[' || c == ']') { error = "Flat JSON required"; return false; }
        else if (c == '{' && ++depth > 1) { error = "Flat JSON required"; return false; }
        else if (c == '}' && --depth < 0) { error = "Invalid JSON"; return false; }
    }
    if (quoted || depth != 0) { error = "Invalid JSON"; return false; }
    std::string terminated(body, length);
    std::unique_ptr<cJSON, decltype(&cJSON_Delete)> json(
        cJSON_ParseWithLengthOpts(terminated.c_str(), terminated.size() + 1, nullptr, true), cJSON_Delete);
    if (!json || !cJSON_IsObject(json.get())) { error = "Invalid JSON"; return false; }
    auto* ssid = cJSON_GetObjectItemCaseSensitive(json.get(), "ssid");
    auto* password = cJSON_GetObjectItemCaseSensitive(json.get(), "password");
    if (!cJSON_IsString(ssid) || strlen(ssid->valuestring) < 1 || strlen(ssid->valuestring) > 32) {
        error = "SSID must contain 1 to 32 UTF-8 bytes"; return false;
    }
    if (!cJSON_IsString(password)) { error = "Password must be a string"; return false; }
    const size_t size = strlen(password->valuestring);
    bool hex_key = size == 64;
    if (hex_key) {
        for (size_t i = 0; i < size; ++i) {
            char c = password->valuestring[i];
            if (!(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f') && !(c >= 'A' && c <= 'F')) hex_key = false;
        }
    }
    if (size != 0 && !(size >= 8 && size <= 63) && !hex_key) {
        error = "Password must be empty, 8 to 63 bytes, or a 64-digit hex key"; return false;
    }
    output = {ssid->valuestring, password->valuestring};
    error.clear();
    return true;
}
}  // namespace stopwatch_provisioning
