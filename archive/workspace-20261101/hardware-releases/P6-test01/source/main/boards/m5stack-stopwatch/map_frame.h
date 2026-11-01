#pragma once
#include <array>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <mutex>
#include <string>
#ifdef ESP_PLATFORM
#include <esp_heap_caps.h>
#endif

namespace MapWire {
constexpr size_t kHeader = 48;
constexpr uint16_t kWidth = 240, kHeight = 240;
constexpr size_t kBytes = size_t(kWidth) * kHeight * 2;
inline uint32_t Read32(const uint8_t* b) { return uint32_t(b[0]) | (uint32_t(b[1]) << 8) | (uint32_t(b[2]) << 16) | (uint32_t(b[3]) << 24); }
inline uint16_t Read16(const uint8_t* b) { return uint16_t(b[0]) | (uint16_t(b[1]) << 8); }
inline uint32_t Crc32(const uint8_t* data, size_t size) {
    uint32_t crc = 0xffffffff;
    for (size_t i = 0; i < size; ++i) {
        crc ^= data[i];
        for (int bit = 0; bit < 8; ++bit) crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}
struct Header { uint32_t id = 0, crc = 0; std::string session; };
inline bool Parse(const uint8_t* b, size_t length, Header& out) {
    if (length != kHeader + kBytes || memcmp(b, "QMAP", 4) || b[4] != 1 || b[5] != 1 || b[6] != 1 || b[7] != 0 ||
        Read16(b + 8) != kWidth || Read16(b + 10) != kHeight || Read32(b + 16) != kBytes) return false;
    for (size_t i = 40; i < kHeader; ++i) if (b[i]) return false;
    out.id = Read32(b + 12); out.crc = Read32(b + 20);
    if (!out.id || out.id > 2000000000) return false;
    static constexpr char hex[] = "0123456789abcdef";
    out.session.clear();
    for (size_t i = 24; i < 40; ++i) { out.session += hex[b[i] >> 4]; out.session += hex[b[i] & 15]; }
    return true;
}
}

struct MapFrame {
    MapWire::Header header;
    std::unique_ptr<uint8_t, decltype(&std::free)> pixels{nullptr, std::free};
    MapFrame() {
#ifdef ESP_PLATFORM
        pixels.reset(static_cast<uint8_t*>(heap_caps_malloc(MapWire::kBytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)));
#else
        pixels.reset(static_cast<uint8_t*>(std::malloc(MapWire::kBytes)));
#endif
    }
};

// One pending image, one displayed image owned by LVGL, one HTTP receive buffer.
// Page/network transitions invalidate incomplete or queued uploads.
class MapFrameMailbox {
public:
    struct Snapshot { bool active; bool pending; uint32_t received, displayed; std::string session; };
    void SetActive(bool active) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (active_ != active) { ++epoch_; pending_.reset(); active_ = active; }
    }
    void Invalidate() { std::lock_guard<std::mutex> lock(mutex_); ++epoch_; pending_.reset(); }
    bool Begin(uint32_t& ticket) {
        std::lock_guard<std::mutex> lock(mutex_);
        ticket = epoch_; return active_ && !pending_;
    }
    bool Current(uint32_t ticket) {
        std::lock_guard<std::mutex> lock(mutex_); return active_ && epoch_ == ticket;
    }
    bool Commit(std::shared_ptr<MapFrame> frame, uint32_t ticket) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_ || epoch_ != ticket || pending_) return false;
        received_ = frame->header.id;
        pending_ = std::move(frame); return true;
    }
    std::shared_ptr<MapFrame> Take() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_) return {};
        return std::move(pending_);
    }
    void Displayed(const MapFrame& frame) {
        std::lock_guard<std::mutex> lock(mutex_);
        displayed_ = frame.header.id; session_ = frame.header.session;
    }
    Snapshot Status() {
        std::lock_guard<std::mutex> lock(mutex_);
        return {active_, bool(pending_), received_, displayed_, session_};
    }
private:
    std::mutex mutex_;
    bool active_ = false;
    uint32_t epoch_ = 0, received_ = 0, displayed_ = 0;
    std::string session_;
    std::shared_ptr<MapFrame> pending_;
};
