#pragma once
#include <array>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <memory>
#include <mutex>
#include <string>
#include "route_frame.h"
#ifdef ESP_PLATFORM
#include <esp_heap_caps.h>
#endif

namespace MapWire {
constexpr size_t kHeader = 48;
constexpr size_t kGeoHeader = 96;
constexpr uint16_t kWidth = 240, kHeight = 240;
constexpr size_t kBytes = size_t(kWidth) * kHeight * 2;
constexpr uint16_t kChunkSize = 480;
constexpr size_t kChunkBytes = size_t(kChunkSize) * kChunkSize * 2;
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
struct Bounds {
    double north = 0, west = 0, south = 0, east = 0;
    bool Valid() const {
        return std::isfinite(north) && std::isfinite(south) && std::isfinite(east) && std::isfinite(west) &&
            north < 85 && south > -85 && west >= -180 && east <= 180 &&
            north > south && east > west && north-south < 0.1 && east-west < 0.1;
    }
    static double Mercator(double lat) { return std::log(std::tan(0.7853981633974483 + lat * 0.008726646259971648)); }
    bool Project(double lat, double lng, double& x, double& y, int size = kWidth) const {
        if (!Valid() || !std::isfinite(lat) || !std::isfinite(lng) || lat < south || lat > north || lng < west || lng > east) return false;
        x = (lng-west)/(east-west)*size;
        y = (Mercator(north)-Mercator(lat))/(Mercator(north)-Mercator(south))*size;
        return x >= 0 && y >= 0 && x < size && y < size;
    }
};
struct Position {
    bool valid = false; uint32_t seq = 0, age_ms = 0;
    uint32_t route_revision=0;double route_progress=0;
    double lat = 0, lng = 0, accuracy = 0;
    int64_t received_ms = 0;
    bool Fresh(int64_t now) const { return valid && now >= received_ms && now-received_ms+age_ms <= 15000 && accuracy > 0 && accuracy <= 50; }
};
struct Header {
    uint32_t id = 0, crc = 0; std::string session; bool geo = false, chunk = false; Bounds bounds;
    uint16_t size = kWidth;
    size_t Bytes() const { return size_t(size)*size*2; }
};
struct Window {
    int x=0,y=0;
    static Window At(double x, double y, int size) {
        const int limit=std::max(0,size-int(kWidth));
        return {std::clamp(int(std::lround(x-kWidth/2)),0,limit),
                std::clamp(int(std::lround(y-kHeight/2)),0,limit)};
    }
};
inline bool Parse(const uint8_t* b, size_t length, Header& out) {
    if(length<kHeader) return false;
    const bool chunk=b[4]==3 && b[5]==3;
    const bool geo = chunk || (b[4] == 2 && b[5] == 2);
    const uint16_t size=chunk?kChunkSize:kWidth;
    const size_t bytes=size_t(size)*size*2;
    if (length != (geo ? kGeoHeader : kHeader) + bytes || memcmp(b, "QMAP", 4) || (!geo && (b[4] != 1 || b[5] != 1)) || b[6] != 1 || b[7] != 0 ||
        Read16(b + 8) != size || Read16(b + 10) != size || Read32(b + 16) != bytes) return false;
    for (size_t i = 40; i < kHeader; ++i) if (b[i]) return false;
    out.geo = geo; out.chunk=chunk; out.size=size;
    if (geo) {
        // ESP32 and our host targets are little endian IEEE754. Decode explicitly.
        auto real = [&](size_t offset) { uint64_t bits = uint64_t(Read32(b+offset)) | (uint64_t(Read32(b+offset+4))<<32); double v; memcpy(&v,&bits,8); return v; };
        out.bounds = {real(48),real(56),real(64),real(72)};
        if (b[80] != 1 || !out.bounds.Valid()) return false; // GCJ-02, north-up Web Mercator
        for(size_t i=81;i<kGeoHeader;++i) if(b[i]) return false;
    }
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
    explicit MapFrame(size_t bytes = MapWire::kBytes) {
        if(bytes!=MapWire::kBytes && bytes!=MapWire::kChunkBytes) return;
#ifdef ESP_PLATFORM
        pixels.reset(static_cast<uint8_t*>(heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)));
#else
        pixels.reset(static_cast<uint8_t*>(std::malloc(bytes)));
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
        if (active_ != active) { ++epoch_; pending_.reset(); route_.reset(); active_ = active; position_.valid = false; }
    }
    void Invalidate() { std::lock_guard<std::mutex> lock(mutex_); ++epoch_; pending_.reset(); route_.reset(); position_.valid = false; }
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
        if(session_!=frame.header.session || !frame.header.geo) route_.reset();
        displayed_ = frame.header.id; session_ = frame.header.session;
        geo_ = frame.header.geo; position_ = {};
    }
    bool SetPosition(uint32_t frame_id, const std::string& session, const MapWire::Position& position) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!active_ || !geo_ || frame_id != displayed_ || session != session_ || position.seq <= position_.seq) return false;
        if(position.route_revision && (!route_ || !route_->active || route_->revision!=position.route_revision ||
            !std::isfinite(position.route_progress) || position.route_progress<0 || position.route_progress>route_->points.size()-1)) return false;
        position_ = position; return true;
    }
    MapWire::Position Position() { std::lock_guard<std::mutex> lock(mutex_); return position_; }
    bool SetRoute(std::shared_ptr<const RouteWire::Frame> route,uint32_t ticket) {
        std::lock_guard<std::mutex> lock(mutex_);
        if(!active_ || epoch_!=ticket || !geo_ || pending_ || session_!=route->session) return false;
        if(route_ && (route->revision<route_->revision || (route->revision==route_->revision && route->crc!=route_->crc))) return false;
        route_=std::move(route);return true;
    }
    std::shared_ptr<const RouteWire::Frame> Route() {std::lock_guard<std::mutex> lock(mutex_);return route_;}
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
    bool geo_ = false;
    MapWire::Position position_;
    std::shared_ptr<const RouteWire::Frame> route_;
};
