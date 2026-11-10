#pragma once
#include "grok_motion.h"
#include "assets.h"
#include "assets/lang_config.h"
#include <esp_heap_caps.h>

class GrokRoundDisplay : public SpiLcdDisplay {
public:
    using SpiLcdDisplay::SpiLcdDisplay;
    ~GrokRoundDisplay() override {
        if(timer_) lv_timer_delete(timer_);
        if(image_) lv_obj_delete(image_);
        heap_caps_free(pixels_);
    }
    void SetupUI() override {
        SpiLcdDisplay::SetupUI();
        DisplayLockGuard lock(this);
        HideOverlay();
        pixels_=static_cast<uint16_t*>(heap_caps_calloc(466*466,sizeof(uint16_t),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT));
        if(!pixels_) {ESP_LOGE("GrokDisplay","No frame buffer");return;}
        descriptor_={};descriptor_.header.magic=LV_IMAGE_HEADER_MAGIC;
        descriptor_.header.cf=LV_COLOR_FORMAT_RGB565;
        descriptor_.header.flags=LV_IMAGE_FLAGS_MODIFIABLE;
        descriptor_.header.w=466;descriptor_.header.h=466;descriptor_.header.stride=466*2;
        descriptor_.data=reinterpret_cast<uint8_t*>(pixels_);descriptor_.data_size=466*466*2;
        image_=lv_image_create(lv_screen_active());lv_image_set_src(image_,&descriptor_);lv_obj_center(image_);
        lv_obj_remove_flag(image_,LV_OBJ_FLAG_CLICKABLE);lv_obj_move_foreground(image_);
        // One timer draws and submits the frame. No independent 40ms/33ms beat pattern.
        timer_=lv_timer_create([](lv_timer_t* timer){static_cast<GrokRoundDisplay*>(lv_timer_get_user_data(timer))->Draw();},17,this);
    }
    void SetTheme(Theme* theme) override {
        SpiLcdDisplay::SetTheme(theme);
        DisplayLockGuard lock(this);HideOverlay();
        if(image_)lv_obj_move_foreground(image_);
    }
    void SetEmotion(const char* emotion) override {
        DisplayLockGuard lock(this);
        pending_=emotion?emotion:"neutral";
        if(motion_.loaded())motion_.SetState(listening_&&pending_=="neutral"?"listening":pending_.c_str(),Now());
    }
    void SetStatus(const char* status) override {
        DisplayLockGuard lock(this);
        listening_=status&&std::strcmp(status,Lang::Strings::LISTENING)==0;
        if(motion_.loaded())motion_.SetState(listening_?"listening":pending_.c_str(),Now());
    }
    void SetChatMessage(const char*,const char*) override {}
    void ClearChatMessages() override {}
    void OnAssetsUnloading() override {
        DisplayLockGuard lock(this);assets_ready_=false;motion_.Unload();
    }
    void OnAssetsLoaded() override {
        DisplayLockGuard lock(this);assets_ready_=true;
        if(timer_)lv_timer_resume(timer_);
    }
    // Keep status checks and low-battery voice alerts; hide only the visual widgets.
    void UpdateStatusBar(bool update_all=false) override {
        SpiLcdDisplay::UpdateStatusBar(update_all);
        DisplayLockGuard lock(this);HideOverlay();
    }
private:
    static uint32_t Now() {return uint32_t(esp_timer_get_time()/1000);}
    void HideOverlay() {
        for(auto* object:{top_bar_,status_bar_,bottom_bar_,side_bar_,content_,emoji_box_,emoji_label_,emoji_image_,preview_image_})
            if(object)lv_obj_add_flag(object,LV_OBJ_FLAG_HIDDEN);
        if(container_)lv_obj_set_style_bg_color(container_,lv_color_black(),0);
        lv_obj_set_style_bg_color(lv_screen_active(),lv_color_black(),0);
    }
    void Draw() {
        if(!pixels_ || !assets_ready_)return;
        if(!motion_.loaded()) {
            void* data=nullptr;size_t size=0;
            if(!Assets::GetInstance().GetAssetData("grok-vectors.bin",data,size))return;
            if(!motion_.Load(data,size)) {ESP_LOGE("GrokDisplay","Invalid vector asset");lv_timer_pause(timer_);return;}
            motion_.SetState(listening_?"listening":pending_.c_str(),Now());
        }
        const int64_t begin=esp_timer_get_time();
        if(!window_start_)window_start_=begin;
        if(last_frame_)worst_interval_us_=std::max(worst_interval_us_,begin-last_frame_);
        last_frame_=begin;
        motion_.Tick(Now());motion_.Render(pixels_);
        const int64_t rendered=esp_timer_get_time();
        // Native RGB565 is used directly by LVGL's bin decoder (no decoded-image cache).
        for(int i=0;i<motion_.dirty_count();i++) {
            const auto& r=motion_.dirty_rect(i);
            const lv_area_t area={r.x1,r.y1,r.x2,r.y2};
            lv_obj_invalidate_area(image_,&area);
        }
        // Submit immediately, then pause the separate refresh timer that invalidation wakes.
        lv_refr_now(display_);
        lv_timer_pause(lv_display_get_refr_timer(display_));
        const int64_t end=esp_timer_get_time();
        render_us_+=rendered-begin;refresh_us_+=end-rendered;
        dirty_pixels_+=motion_.dirty_pixels();++frames_;
        const int64_t elapsed=end-window_start_;
        if(elapsed>=5000000) {
            const uint32_t fps100=uint32_t(frames_*100000000LL/elapsed);
            ESP_LOGI("GrokPerf","v5 submissions %lu.%02lu fps; draw %lld us; refresh %lld us; dirty %llu%%; worst interval %lld ms",
                (unsigned long)(fps100/100),(unsigned long)(fps100%100),render_us_/frames_,refresh_us_/frames_,
                dirty_pixels_*100/(uint64_t(frames_)*466*466),worst_interval_us_/1000);
            window_start_=end;frames_=0;render_us_=refresh_us_=0;dirty_pixels_=0;worst_interval_us_=0;
        }
    }
    GrokMotion motion_;
    lv_obj_t* image_=nullptr;
    lv_timer_t* timer_=nullptr;
    uint16_t* pixels_=nullptr;
    lv_image_dsc_t descriptor_{};
    std::string pending_="neutral";
    bool listening_=false;
    bool assets_ready_=false;
    uint32_t frames_=0;
    int64_t render_us_=0,refresh_us_=0,window_start_=0,last_frame_=0,worst_interval_us_=0;
    uint64_t dirty_pixels_=0;
};
