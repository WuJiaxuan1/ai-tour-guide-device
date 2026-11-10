#include "stopwatch_haptics.h"
#include "config.h"
#include <esp_log.h>
#include <esp_timer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

static uint32_t HapticNow() {return static_cast<uint32_t>(esp_timer_get_time()/1000);}
bool StopwatchHaptics::Initialize(i2c_master_bus_handle_t bus,M5IOE1& ioe,std::function<void(bool)> mute) {
    static_assert(IOE_PIN_MOTOR==M5IOE1_PIN_9,"PWM1 must drive the StopWatch IO9 motor");
    i2c_device_config_t config{};
    config.dev_addr_length=I2C_ADDR_BIT_LEN_7;config.device_address=M5IOE1_I2C_ADDR;
    config.scl_speed_hz=100000;
    // Borrow the native bus; this device handle is only for bounded PWM writes.
    if(!bus || i2c_master_bus_add_device(bus,&config,&device_)!=ESP_OK) return false;
    if(ioe.setPwmFrequency(200)!=M5IOE1_OK ||
       ioe.setPwmDuty12bit(M5IOE1_PWM_CH1,0,false,true)!=M5IOE1_OK || !Write(0)) {
        Write(0);i2c_master_bus_rm_device(device_);device_=nullptr;
        ESP_LOGW("StopwatchHaptics","PWM setup failed; feedback disabled");return false;
    }
    mute_=std::move(mute);queue_.Enable();
    if(xTaskCreate([](void* arg){static_cast<StopwatchHaptics*>(arg)->Run();},
        "stopwatch_haptic",3072,this,3,nullptr)!=pdPASS) {
        queue_.Disable();Write(0);i2c_master_bus_rm_device(device_);device_=nullptr;return false;
    }
    ESP_LOGI("StopwatchHaptics","Ready: PWM1 IO9 200Hz; strength160/255 45ms; IMU tail180ms");
    return true;
}
void StopwatchHaptics::Feedback(AvatarFeedback event) {queue_.Push(event,HapticNow());}
bool StopwatchHaptics::Write(uint8_t strength) {
    const auto command=AvatarMotorCommand(strength);
    const bool ok=device_ && i2c_master_transmit(device_,command.data(),command.size(),20)==ESP_OK;
    if(ok) ESP_LOGI("StopwatchHaptics","PWM %s acknowledged; strength=%u",strength?"ON":"OFF",unsigned(strength));
    return ok;
}
void StopwatchHaptics::Run() {
    AvatarHapticRunner runner(queue_,[this](uint8_t strength){return Write(strength);},mute_,HapticNow);
    bool reported=false;
    for(;;) {
        runner.Poll();
        if(runner.Failed() && !reported) {
            reported=true;
            ESP_LOGW("StopwatchHaptics","PWM write failed; new pulses disabled, retrying OFF until acknowledged");
        }
        vTaskDelay(pdMS_TO_TICKS(5)>0?pdMS_TO_TICKS(5):1);
    }
}
