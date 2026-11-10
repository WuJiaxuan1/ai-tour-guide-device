#pragma once
#include "avatar_haptic.h"
#include "M5IOE1.h"
#include <driver/i2c_master.h>

class StopwatchHaptics {
public:
    bool Initialize(i2c_master_bus_handle_t bus,M5IOE1& ioe,std::function<void(bool)> mute);
    void Feedback(AvatarFeedback event);
private:
    i2c_master_dev_handle_t device_=nullptr;
    AvatarHapticQueue queue_;
    std::function<void(bool)> mute_;
    bool Write(uint8_t strength);
    void Run();
};
