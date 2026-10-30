#pragma once
#include <cstdint>
inline uint32_t esp_random() { static uint32_t count = 0x12345678; return count++; }
