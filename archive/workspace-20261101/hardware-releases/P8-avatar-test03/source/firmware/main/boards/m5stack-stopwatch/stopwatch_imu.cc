#include "stopwatch_imu.h"
#include "config.h"
#include <esp_log.h>

static constexpr const char* kTag="StopwatchImu";
bool StopwatchImu::Initialize(i2c_master_bus_handle_t existing_bus) {
    // Probe before library initialization. An absent sensor must never prevent
    // voice, networking or the existing touch task from starting.
    if(i2c_master_probe(existing_bus,BMI270_I2C_ADDRESS,40)!=ESP_OK) {
        ESP_LOGW(kTag,"BMI270 absent at 0x68; tilt disabled");return false;
    }
    i2c_config_t config{};
    config.mode=I2C_MODE_MASTER;
    config.sda_io_num=AUDIO_CODEC_I2C_SDA_PIN;
    config.scl_io_num=AUDIO_CODEC_I2C_SCL_PIN;
    config.sda_pullup_en=GPIO_PULLUP_ENABLE;config.scl_pullup_en=GPIO_PULLUP_ENABLE;
    config.master.clk_speed=100000;
    // i2c_bus v2 explicitly adopts the IDF bus created by InitializeI2c.
    // Do not call i2c_bus_delete: it would delete the shared codec/touch bus.
    bus_=i2c_bus_create(I2C_NUM_0,&config);
    if(!bus_ || i2c_bus_get_internal_bus_handle(bus_)!=existing_bus) return false;
    const auto result=bmi270_sensor_create(bus_,&sensor_,bmi270_config_file,
        BMI2_GYRO_CROSS_SENS_ENABLE | BMI2_CRT_RTOSK_ENABLE);
    if(result!=ESP_OK || !sensor_) {
        ESP_LOGW(kTag,"BMI270 initialization failed (%s); tilt disabled",esp_err_to_name(result));return false;
    }
    bmi2_sens_config settings[2]{};
    settings[0].type=BMI2_ACCEL;settings[1].type=BMI2_GYRO;
    int8_t status=bmi2_get_sensor_config(settings,2,sensor_);
    if(status==BMI2_OK) {
        settings[0].cfg.acc.odr=BMI2_ACC_ODR_100HZ;
        settings[0].cfg.acc.range=BMI2_ACC_RANGE_4G;
        settings[0].cfg.acc.bwp=BMI2_ACC_NORMAL_AVG4;
        settings[0].cfg.acc.filter_perf=BMI2_PERF_OPT_MODE;
        settings[1].cfg.gyr.odr=BMI2_GYR_ODR_100HZ;
        settings[1].cfg.gyr.range=BMI2_GYR_RANGE_2000;
        settings[1].cfg.gyr.bwp=BMI2_GYR_NORMAL_MODE;
        settings[1].cfg.gyr.noise_perf=BMI2_POWER_OPT_MODE;
        settings[1].cfg.gyr.filter_perf=BMI2_PERF_OPT_MODE;
        status=bmi2_set_sensor_config(settings,2,sensor_);
    }
    const uint8_t sensors[]={BMI2_ACCEL,BMI2_GYRO};
    if(status==BMI2_OK) status=bmi270_sensor_enable(sensors,2,sensor_);
    if(status!=BMI2_OK) {
        ESP_LOGW(kTag,"BMI270 configuration failed (%d); tilt disabled",status);
        bmi270_sensor_del(&sensor_);return false;
    }
    ESP_LOGI(kTag,"BMI270 ready: +/-4g, +/-2000dps, 100Hz; acquisition target 50Hz, avatar timer 25Hz");
    return true;
}
bool StopwatchImu::Read(AvatarImuSample& sample) {
    if(!sensor_) return false;
    uint8_t status=0;
    if(bmi2_get_status(&status,sensor_)!=BMI2_OK ||
       (status & (BMI2_DRDY_ACC | BMI2_DRDY_GYR))!=(BMI2_DRDY_ACC | BMI2_DRDY_GYR)) return false;
    bmi2_sens_data data{};
    if(bmi2_get_sensor_data(&data,sensor_)!=BMI2_OK) return false;
    constexpr float acc=4.f/32768.f,gyro=2000.f/32768.f;
    sample={data.acc.x*acc,data.acc.y*acc,data.acc.z*acc,
            data.gyr.x*gyro,data.gyr.y*gyro,data.gyr.z*gyro};
    return true;
}
