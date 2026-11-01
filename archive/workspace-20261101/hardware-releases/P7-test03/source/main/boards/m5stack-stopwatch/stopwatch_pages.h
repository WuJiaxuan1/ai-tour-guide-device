#pragma once
#include <lvgl.h>
#include <cstdio>
#include <src/misc/cache/instance/lv_image_cache.h>
#include "map_frame.h"

// Caller holds the display lock. Both roots persist; switching never destroys
// upstream chat widgets or changes LVGL's active screen.
class StopwatchPages {
public:
    void Initialize(lv_obj_t* screen, int width, int height) {
        if (voice_) return;
        width_ = width;
        height_ = height;
        const auto count = lv_obj_get_child_count(screen);
        voice_ = CreateRoot(screen, width, height, 0x000000);
        for (uint32_t i = 0; i < count; ++i) {
            lv_obj_set_parent(lv_obj_get_child(screen, 0), voice_);
        }
        auto hint = Label(voice_, "左滑 / 右键：地图", 320, height - 66);
        lv_obj_set_style_text_color(hint, lv_color_hex(0x8ABCAA), 0);

        map_ = CreateRoot(screen, width, height, 0x10241E);
        title_ = Label(map_, "周边地图 · 北朝上", 360, 58);
        gps_status_ = Label(map_, "GPS: waiting for phone", 330, 92);
        lv_obj_set_style_text_font(gps_status_, LV_FONT_DEFAULT, 0);
        image_ = lv_image_create(map_);
        lv_obj_align(image_, LV_ALIGN_TOP_MID, 0, 112);
        lv_obj_add_flag(image_, LV_OBJ_FLAG_HIDDEN);
        marker_ = lv_obj_create(map_);
        lv_obj_remove_style_all(marker_);
        lv_obj_set_size(marker_, 24, 24);
        lv_obj_set_style_radius(marker_, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(marker_, lv_color_hex(0x008CFF), 0);
        lv_obj_set_style_bg_opa(marker_, LV_OPA_COVER, 0);
        lv_obj_set_style_border_color(marker_, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_style_border_width(marker_, 3, 0);
        lv_obj_add_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        note_ = Label(map_, "等待手机发送地图\n\n此页暂停语音", 330, 178);
        lv_obj_set_style_text_color(note_, lv_color_hex(0xCBD9D0), 0);
        map_status_ = Label(map_, "", 330, 355);
        lv_obj_set_style_text_font(map_status_, LV_FONT_DEFAULT, 0);
        return_hint_ = Label(map_, "右滑 / 左键：语音", 320, height - 66);
        SetOffset(0);
    }

    void ShowMap(bool map) {
        if (!voice_ || map == map_shown_) return;
        map_shown_ = map;
        lv_anim_delete(this, AnimateOffset);
        lv_anim_t animation;
        lv_anim_init(&animation);
        lv_anim_set_var(&animation, this);
        lv_anim_set_values(&animation, offset_, map ? -width_ : 0);
        lv_anim_set_duration(&animation, 240);
        lv_anim_set_exec_cb(&animation, AnimateOffset);
        lv_anim_set_path_cb(&animation, lv_anim_path_ease_in_out);
        lv_anim_start(&animation);
    }

    void SetStatus(const char* text) {
        if (map_status_) lv_label_set_text(map_status_, text);
    }
    bool IsMapShown() const { return map_shown_; }
    bool SetImage(std::shared_ptr<MapFrame> frame) {
        if (!map_shown_ || !image_ || !frame || !frame->pixels) return false;
        // Keep old pixels alive until LVGL's descriptor/cache has switched.
        lv_image_cache_drop(&image_descriptor_);
        auto previous = std::move(frame_);
        frame_ = std::move(frame);
        image_descriptor_ = {};
        image_descriptor_.header.magic = LV_IMAGE_HEADER_MAGIC;
        image_descriptor_.header.cf = LV_COLOR_FORMAT_RGB565;
        image_descriptor_.header.w = MapWire::kWidth;
        image_descriptor_.header.h = MapWire::kHeight;
        image_descriptor_.header.stride = MapWire::kWidth * 2;
        image_descriptor_.data_size = MapWire::kBytes;
        image_descriptor_.data = frame_->pixels.get();
        lv_image_set_src(image_, &image_descriptor_);
        const bool geo=frame_->header.geo;
        if(geo) {
            lv_obj_set_size(image_,width_,height_);
            lv_image_set_inner_align(image_,LV_IMAGE_ALIGN_STRETCH);
            lv_obj_align(image_,LV_ALIGN_TOP_LEFT,0,0);
            lv_obj_add_flag(map_status_,LV_OBJ_FLAG_HIDDEN);
            lv_obj_add_flag(return_hint_,LV_OBJ_FLAG_HIDDEN);
            lv_obj_set_style_text_font(title_,LV_FONT_DEFAULT,0);
            lv_obj_set_width(title_,48);
            lv_obj_align(title_,LV_ALIGN_TOP_MID,0,20);
            lv_obj_set_width(gps_status_,260);
            lv_obj_align(gps_status_,LV_ALIGN_TOP_MID,0,42);
            lv_obj_set_style_bg_color(gps_status_,lv_color_hex(0x10241E),0);
            lv_obj_set_style_bg_opa(gps_status_,LV_OPA_80,0);
            lv_obj_set_style_bg_color(title_,lv_color_hex(0x10241E),0);
            lv_obj_set_style_bg_opa(title_,LV_OPA_80,0);
        } else {
            lv_image_set_inner_align(image_,LV_IMAGE_ALIGN_DEFAULT);
            lv_image_set_scale(image_,256);
            lv_obj_set_size(image_,MapWire::kWidth,MapWire::kHeight);
            lv_obj_align(image_,LV_ALIGN_TOP_MID,0,112);
            lv_obj_remove_flag(map_status_,LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_flag(return_hint_,LV_OBJ_FLAG_HIDDEN);
            lv_obj_remove_local_style_prop(title_,LV_STYLE_TEXT_FONT,0);
            lv_obj_set_width(title_,360);
            lv_obj_align(title_,LV_ALIGN_TOP_MID,0,58);
            lv_obj_set_width(gps_status_,330);
            lv_obj_align(gps_status_,LV_ALIGN_TOP_MID,0,92);
        }
        lv_obj_remove_flag(image_, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(note_, LV_OBJ_FLAG_HIDDEN);
        lv_obj_invalidate(image_);
        lv_label_set_text(title_, geo ? "N" : "测试图 · 非真实地图");
        lv_obj_move_foreground(marker_);
        lv_obj_move_foreground(title_);
        lv_obj_move_foreground(gps_status_);
        lv_obj_add_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        return true;
    }
    void SetPosition(const MapWire::Position& position, int64_t now) {
        if (!marker_) return;
        lv_obj_add_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        if (!frame_ || !frame_->header.geo) {
            lv_label_set_text(gps_status_, frame_ ? "TEST IMAGE / NO GPS" : "GPS: waiting for phone"); return;
        }
        if (!map_shown_ || !position.Fresh(now)) {
            lv_label_set_text(gps_status_, position.accuracy > 50 && position.valid ? "GPS: low accuracy" : "GPS: waiting / stale"); return;
        }
        double x=0,y=0;
        if (!frame_->header.bounds.Project(position.lat,position.lng,x,y)) {
            lv_label_set_text(gps_status_, "GPS: waiting for new map"); return;
        }
        // Same source-to-screen transform as the full-screen stretched image.
        lv_obj_set_pos(marker_,int(std::lround(x*width_/MapWire::kWidth))-12,
            int(std::lround(y*height_/MapWire::kHeight))-12);
        lv_obj_remove_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        char text[64]; std::snprintf(text,sizeof(text),"GPS +/-%.0fm  age %llds",position.accuracy,
            static_cast<long long>((now-position.received_ms+position.age_ms)/1000));
        lv_label_set_text(gps_status_,text);
    }

private:
    lv_obj_t* voice_ = nullptr;
    lv_obj_t* map_ = nullptr;
    lv_obj_t* map_status_ = nullptr;
    lv_obj_t* note_ = nullptr;
    lv_obj_t* image_ = nullptr;
    lv_obj_t* title_ = nullptr;
    lv_obj_t* marker_ = nullptr;
    lv_obj_t* gps_status_ = nullptr;
    lv_obj_t* return_hint_ = nullptr;
    lv_image_dsc_t image_descriptor_{};
    std::shared_ptr<MapFrame> frame_;
    int width_ = 0;
    int height_ = 0;
    int offset_ = 0;
    bool map_shown_ = false;

    static lv_obj_t* CreateRoot(lv_obj_t* screen, int width, int height, uint32_t color) {
        auto root = lv_obj_create(screen);
        lv_obj_remove_style_all(root);
        lv_obj_set_size(root, width, height);
        lv_obj_remove_flag(root, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_bg_color(root, lv_color_hex(color), 0);
        lv_obj_set_style_bg_opa(root, LV_OPA_COVER, 0);
        lv_obj_set_style_text_color(root, lv_color_hex(0xFFFFFF), 0);
        return root;
    }
    static lv_obj_t* Label(lv_obj_t* root, const char* text, int width, int y) {
        auto label = lv_label_create(root);
        lv_obj_set_width(label, width);
        lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_text(label, text);
        lv_obj_align(label, LV_ALIGN_TOP_MID, 0, y);
        return label;
    }
    void SetOffset(int value) {
        offset_ = value;
        lv_obj_set_x(voice_, value);
        lv_obj_set_x(map_, value + width_);
    }
    static void AnimateOffset(void* self, int32_t value) {
        static_cast<StopwatchPages*>(self)->SetOffset(value);
    }
};
