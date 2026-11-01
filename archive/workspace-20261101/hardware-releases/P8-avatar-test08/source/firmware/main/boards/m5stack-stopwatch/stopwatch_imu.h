#pragma once
#include "avatar_input.h"
#include <driver/i2c_master.h>
#include <bmi270_api.h>

class StopwatchImu {
public:
    bool Initialize(i2c_master_bus_handle_t existing_bus);
    bool Read(AvatarImuSample& sample);
private:
    i2c_bus_handle_t bus_=nullptr; // borrowed underlying bus; never delete it
    bmi270_handle_t sensor_=nullptr;
};
