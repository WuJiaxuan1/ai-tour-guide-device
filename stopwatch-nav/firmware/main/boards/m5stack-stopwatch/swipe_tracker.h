#pragma once
#include <cstdint>
#include <cstdlib>

// One horizontal swipe per contact. Buttons and gestures share page actions.
class SwipeTracker {
public:
    // -1 = left, +1 = right, 0 = no gesture. Invalid samples cancel this contact.
    int Update(bool valid, bool pressed, int x, int y, uint32_t now_ms) {
        if (!valid) { active_ = false; consumed_ = true; return 0; }
        if (!pressed) { active_ = consumed_ = false; return 0; }
        if (consumed_) return 0;
        if (!active_) { active_ = true; x_ = x; y_ = y; started_ = now_ms; return 0; }
        if (now_ms - started_ > 1200) { consumed_ = true; return 0; }
        const int dx = x - x_, dy = y - y_;
        if (std::abs(dx) < 65 || std::abs(dx) * 2 < std::abs(dy) * 3) return 0;
        consumed_ = true;
        return dx < 0 ? -1 : 1;
    }
private:
    bool active_ = false, consumed_ = false;
    int x_ = 0, y_ = 0;
    uint32_t started_ = 0;
};
