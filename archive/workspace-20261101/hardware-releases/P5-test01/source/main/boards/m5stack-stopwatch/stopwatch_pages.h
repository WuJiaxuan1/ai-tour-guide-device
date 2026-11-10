#pragma once
#include <lvgl.h>

// Caller holds the display lock. Both roots persist; switching never destroys
// upstream chat widgets or changes LVGL's active screen.
class StopwatchPages {
public:
    void Initialize(lv_obj_t* screen, int width, int height) {
        if (voice_) return;
        width_ = width;
        const auto count = lv_obj_get_child_count(screen);
        voice_ = CreateRoot(screen, width, height, 0x000000);
        for (uint32_t i = 0; i < count; ++i) {
            lv_obj_set_parent(lv_obj_get_child(screen, 0), voice_);
        }
        auto hint = Label(voice_, "右键：地图", 280, height - 58);
        lv_obj_set_style_text_color(hint, lv_color_hex(0x8ABCAA), 0);

        map_ = CreateRoot(screen, width, height, 0x10241E);
        Label(map_, "周边地图", 300, 105);
        auto note = Label(map_, "地图尚未接入\n\n此页暂停语音", 320, 178);
        lv_obj_set_style_text_color(note, lv_color_hex(0xCBD9D0), 0);
        map_status_ = Label(map_, "", 330, 305);
        lv_obj_set_style_text_font(map_status_, LV_FONT_DEFAULT, 0);
        Label(map_, "左键：返回语音", 300, height - 105);
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

private:
    lv_obj_t* voice_ = nullptr;
    lv_obj_t* map_ = nullptr;
    lv_obj_t* map_status_ = nullptr;
    int width_ = 0;
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
