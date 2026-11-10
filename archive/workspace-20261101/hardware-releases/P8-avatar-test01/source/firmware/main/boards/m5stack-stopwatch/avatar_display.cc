// SPDX-License-Identifier: AGPL-3.0-or-later
#include "avatar_display.h"
#include <cstring>
#include <cstdlib>
#include <src/misc/cache/instance/lv_image_cache.h>
#ifdef ESP_PLATFORM
#include <esp_heap_caps.h>
#endif

AvatarDisplay::~AvatarDisplay() {
    if(timer_) lv_timer_delete(timer_);
    if(image_) lv_obj_delete(image_);
    lv_image_cache_drop(&descriptor_);
    std::free(pixels_);
}
bool AvatarDisplay::Initialize(lv_obj_t* parent,int width,int height) {
    if(image_) return true;
    const size_t bytes=size_t(width)*height*2;
#ifdef ESP_PLATFORM
    pixels_=static_cast<uint16_t*>(heap_caps_calloc(1,bytes,MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
#else
    pixels_=static_cast<uint16_t*>(std::calloc(1,bytes));
#endif
    if(!pixels_) return false; // Keep the original usable UI on allocation failure.
    surface_=std::make_unique<AvatarSurface>(pixels_,width,height);
    engine_.begin(surface_.get(),lv_tick_get());
    descriptor_.header.magic=LV_IMAGE_HEADER_MAGIC;
    descriptor_.header.cf=LV_COLOR_FORMAT_RGB565;
    descriptor_.header.w=width;descriptor_.header.h=height;
    descriptor_.header.stride=width*2;
    descriptor_.data_size=bytes;descriptor_.data=reinterpret_cast<uint8_t*>(pixels_);
    image_=lv_image_create(parent);
    lv_image_set_src(image_,&descriptor_);
    lv_obj_set_pos(image_,0,0);
    lv_obj_remove_flag(image_,LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(image_,LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(image_,LV_OBJ_FLAG_HIDDEN);
    timer_=lv_timer_create([](lv_timer_t* timer) {
        static_cast<AvatarDisplay*>(lv_timer_get_user_data(timer))->Render();
    },40,this);
    lv_timer_pause(timer_);
    return true;
}
void AvatarDisplay::SetVisible(bool visible) {
    if(!image_ || visible_==visible) return;
    visible_=visible;
    if(visible) {
        lv_obj_remove_flag(image_,LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(image_);
        engine_.invalidate();
    } else lv_obj_add_flag(image_,LV_OBJ_FLAG_HIDDEN);
    RefreshTimer();
}
void AvatarDisplay::SetPaused(bool paused) {
    if(paused_==paused) return;
    paused_=paused;
    if(!paused) engine_.invalidate();
    RefreshTimer();
}
void AvatarDisplay::RefreshTimer() {
    if(!timer_) return;
    if(visible_ && !paused_) {Render();lv_timer_resume(timer_);lv_timer_ready(timer_);}
    else lv_timer_pause(timer_);
}
void AvatarDisplay::SetBase(ExpressionId state) {
    if(base_==state && engine_.baseExpression()==state) return;
    base_=state;
    engine_.show(state,lv_tick_get(),false);
}
void AvatarDisplay::SetEmotion(const char* emotion) {
    if(!emotion || !visible_ || paused_) return;
    // Neutral means the CURRENT voice state, never forcibly idle.
    if(std::strcmp(emotion,"neutral")==0) {
        if(engine_.activeExpression()!=base_) engine_.show(base_,lv_tick_get(),false);
        return;
    }
    struct Mapping {const char* name;ExpressionId id;};
    static const Mapping mappings[]={
        {"happy",ExpressionId::Happy},{"laughing",ExpressionId::Excited},
        {"funny",ExpressionId::Excited},{"excited",ExpressionId::Excited},
        {"curious",ExpressionId::Curious},{"confused",ExpressionId::Confused},
        {"angry",ExpressionId::Angry},{"surprised",ExpressionId::Surprised},
        {"shocked",ExpressionId::Surprised},{"sad",ExpressionId::Sad},
        {"crying",ExpressionId::Sad},{"sleepy",ExpressionId::Sleepy},
        {"dizzy",ExpressionId::Dizzy},{"thinking",ExpressionId::Thinking}};
    for(const auto& mapping:mappings) if(std::strcmp(emotion,mapping.name)==0) {
        // Cloud 'thinking' is a reaction, not a replacement of the voice base.
        engine_.react(mapping.id,lv_tick_get());
        return;
    }
}
void AvatarDisplay::Render() {
    if(!visible_ || paused_) return;
    engine_.update(lv_tick_get());
    lv_image_cache_drop(&descriptor_);
    int x1,y1,x2,y2;
    if(surface_->Dirty(x1,y1,x2,y2)) {
        lv_area_t coords;lv_obj_get_coords(image_,&coords);
        lv_area_t dirty={coords.x1+x1,coords.y1+y1,coords.x1+x2,coords.y1+y2};
        lv_obj_invalidate_area(image_,&dirty);
    }
}
