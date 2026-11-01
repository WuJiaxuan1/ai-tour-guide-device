#pragma once
#ifdef ESP_PLATFORM
#include "map_frame.h"
#include <atomic>
#include <functional>
#include <mutex>
#include <string>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

class CloudNavigation {
public:
    CloudNavigation(MapFrameMailbox& images, std::function<void()> notify);
    ~CloudNavigation();
    void SetOnline(bool value) { online_=value; }
    bool Configure(const std::string& origin,const std::string& trip,const std::string& token);
    std::string State();
private:
    struct Config {std::string origin,trip,token;uint32_t generation=0;};
    MapFrameMailbox& images_;std::function<void()> notify_;
    std::mutex mutex_;Config config_;std::string state_="not_configured";
    std::atomic<bool> online_{false},stopping_{false},running_{false};
    TaskHandle_t task_=nullptr;
    void Run();void Poll(const Config& config);void State(const std::string& state);
    bool Current(const Config& config,uint32_t ticket);
};
#endif
