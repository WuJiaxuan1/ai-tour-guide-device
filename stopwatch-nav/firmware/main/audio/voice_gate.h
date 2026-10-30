#pragma once
#include <atomic>
#include <cstdint>

// Single control-task writer; audio/network tasks can retain and check tickets.
// Changing page invalidates work already in flight, even after returning.
class VoiceGate {
public:
    uint32_t Capture() const { return state_.load(); }
    bool IsPaused() const { return (Capture() & 1u) != 0; }
    bool Allows(uint32_t ticket) const { return !(ticket & 1u) && Capture() == ticket; }
    void SetPaused(bool paused) {
        const auto old = Capture();
        if (bool(old & 1u) == paused) return;
        state_.store(((old & ~1u) + 2u) | (paused ? 1u : 0u));
    }
private:
    std::atomic<uint32_t> state_{0};
};
