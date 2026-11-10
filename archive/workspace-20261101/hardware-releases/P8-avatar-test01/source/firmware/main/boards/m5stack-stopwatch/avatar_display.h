// SPDX-License-Identifier: AGPL-3.0-or-later
#pragma once
#include "avatar_engine.h"
#include <lvgl.h>
#include <memory>

// All methods run under the display lock; timer callbacks already own it.
class AvatarDisplay {
public:
    ~AvatarDisplay();
    bool Initialize(lv_obj_t* parent,int width,int height);
    void SetVisible(bool visible);
    void SetPaused(bool paused);
    void SetBase(ExpressionId state);
    void SetEmotion(const char* emotion);
    bool Visible() const { return visible_; }
    ExpressionId Base() const { return base_; }
    ExpressionId Active() const { return engine_.activeExpression(); }
private:
    lv_obj_t* image_=nullptr;
    lv_timer_t* timer_=nullptr;
    lv_image_dsc_t descriptor_{};
    uint16_t* pixels_=nullptr;
    std::unique_ptr<AvatarSurface> surface_;
    AvatarEngine engine_;
    ExpressionId base_=ExpressionId::Idle;
    bool visible_=false,paused_=false;
    void RefreshTimer();
    void Render();
};
