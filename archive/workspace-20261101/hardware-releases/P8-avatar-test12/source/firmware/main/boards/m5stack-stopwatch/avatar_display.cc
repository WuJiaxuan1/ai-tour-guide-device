// SPDX-License-Identifier: AGPL-3.0-or-later
#include "avatar_display.h"
#include <cstring>
#include <cstdlib>
#include <src/misc/cache/instance/lv_image_cache.h>
#ifdef ESP_PLATFORM
#include <esp_heap_caps.h>
#include <esp_log.h>
#include <esp_timer.h>
#include <esp_app_desc.h>
#endif

static uint32_t MotionNowMs() {
#ifdef ESP_PLATFORM
    return static_cast<uint32_t>(esp_timer_get_time()/1000);
#else
    return lv_tick_get();
#endif
}

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
    ResetInteraction();
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
    ResetInteraction();
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
    if(feedback_) feedback_(AvatarFeedback::Cancel);
    base_=state;
    if(state==ExpressionId::Idle) listen_feedback_sent_=false;
    CancelShake();
    taps_.Cancel();
    engine_.show(state,lv_tick_get(),false);
    if(visible_ && !paused_ && state==ExpressionId::Listening && !listen_feedback_sent_) {
        listen_feedback_sent_=true;
        if(feedback_) feedback_(AvatarFeedback::Listen);
    }
}
void AvatarDisplay::SetEmotion(const char* emotion) {
    if(!emotion || !visible_ || paused_) return;
    // Neutral means the CURRENT voice state, never forcibly idle.
    if(std::strcmp(emotion,"neutral")==0) {
        CancelShake();
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
        CancelShake();
        // Cloud 'thinking' is a reaction, not a replacement of the voice base.
        engine_.react(mapping.id,lv_tick_get());
        return;
    }
}
void AvatarDisplay::Render() {
    if(!visible_ || paused_) return;
    // Count fresh gestures only while idle. Samples during a Dizzy reaction
    // cannot restart it or become a queued reaction after playback.
    shake_.SetEnabled(base_==ExpressionId::Idle &&
        engine_.activeExpression()==ExpressionId::Idle);
    if(shake_.Take(MotionNowMs())) {
        taps_.Cancel();shake_reaction_=true;
        engine_.react(ExpressionId::Dizzy,lv_tick_get());
        shake_.SetEnabled(false);
        // Feedback belongs to the displayed gesture, never raw sensor peaks.
        if(feedback_) feedback_(AvatarFeedback::Shake);
#ifdef ESP_PLATFORM
        ESP_LOGI("StopwatchAvatar","Repeated horizontal shake -> DIZZY");
#endif
    }
    ConsumeMotion();
    if(motion_active_ && MotionNowMs()-last_motion_>500) {
        // Brief stalls fade toward neutral. Longer outages clear smoothing only;
        // the vertical reference is a constant and never gets recalibrated.
        engine_.setTiltTarget(0,0);
        if(MotionNowMs()-last_motion_>2000) {
            tilt_.Reset();motion_active_=tilt_ready_=false;
        }
    }
    engine_.update(lv_tick_get());
    if(shake_reaction_ && engine_.activeExpression()!=ExpressionId::Dizzy) {
        shake_reaction_=false;
        shake_.SetEnabled(base_==ExpressionId::Idle && engine_.activeExpression()==ExpressionId::Idle);
#ifdef ESP_PLATFORM
        ESP_LOGI("StopwatchAvatar","DIZZY completed; fresh shake recognition rearmed");
#endif
    }
    lv_image_cache_drop(&descriptor_);
    int x1,y1,x2,y2;
    if(surface_->Dirty(x1,y1,x2,y2)) {
        lv_area_t coords;lv_obj_get_coords(image_,&coords);
        lv_area_t dirty={coords.x1+x1,coords.y1+y1,coords.x1+x2,coords.y1+y2};
        lv_obj_invalidate_area(image_,&dirty);
    }
}

void AvatarDisplay::ResetInteraction() {
    if(feedback_) feedback_(AvatarFeedback::Cancel);
    listen_feedback_sent_=false;
    CancelShake();
    motion_mailbox_.Clear();
    taps_.Cancel();tilt_.Reset();motion_active_=tilt_ready_=false;
    engine_.setTiltTarget(0,0);
}
void AvatarDisplay::Touch(bool valid,bool pressed,int x,int y,uint32_t now,bool swipe) {
    const auto event=taps_.Update(visible_ && !paused_ && base_==ExpressionId::Idle,
        valid,pressed,x,y,now,swipe);
    if(event==AvatarTapTracker::Event::Single || event==AvatarTapTracker::Event::Double) {
        CancelShake();
        engine_.react(event==AvatarTapTracker::Event::Single?ExpressionId::Surprised:ExpressionId::Happy,lv_tick_get());
        if(feedback_) feedback_(AvatarFeedback::Tap);
    }
}
void AvatarDisplay::CancelShake() {
    shake_.SetEnabled(false);
    if(shake_reaction_) engine_.show(base_,lv_tick_get(),false);
    shake_reaction_=false;
}
void AvatarDisplay::Motion(bool valid,const AvatarImuSample& sample,uint32_t now) {
    motion_mailbox_.Publish(valid && !motion_suppressed_.load(),sample,now);
    shake_.Publish(valid,sample,now);
#ifdef ESP_PLATFORM
    AvatarShakeInput::Diagnostics d;
    if(shake_.ReadDiagnostics(now,d)) ESP_LOGI("StopwatchAvatar",
        "ShakeDiag ver=%s enabled=%d cool=%d motor_muted=%d good=%lu missing=%lu invalid=%lu gap=%lu peak=%.2f/%.2f/%.2f swings=%lu event=%lu shown=%lu expired=%lu gates=%lu gyro=%.1f turning=%d rotation_rejects=%lu",
        esp_app_get_description()->version,int(d.enabled),int(d.cooling),int(d.suppressed),
        (unsigned long)d.samples,(unsigned long)d.missing,(unsigned long)d.invalid,
        (unsigned long)d.max_gap,d.peak_x,d.peak_y,d.peak_z,(unsigned long)d.max_swings,
        (unsigned long)d.events,(unsigned long)d.delivered,(unsigned long)d.expired,
        (unsigned long)d.gate_changes,d.peak_gyro,int(d.turning),(unsigned long)d.rotation_rejects);
#endif
}
void AvatarDisplay::SetMotionSuppressed(bool suppressed) {
    if(suppressed) motion_suppressed_.store(true);
    motion_mailbox_.Clear();
    shake_.SetSuppressed(suppressed);
    if(!suppressed) motion_suppressed_.store(false);
}
void AvatarDisplay::ConsumeMotion() {
    if(motion_suppressed_.load()) return;
    AvatarImuSample sample{};uint32_t now=0;
    if(!motion_mailbox_.Take(sample,now,MotionNowMs())) return;
    const auto target=tilt_.Update(sample,now);
#ifdef ESP_PLATFORM
    if(target.ready && !tilt_ready_) ESP_LOGI("StopwatchAvatar",
        "IMU fixed vertical reference active (no calibration/gyro lead); accel %.2f %.2f %.2f",
        sample.ax,sample.ay,sample.az);
#endif
    tilt_ready_=target.ready;
    last_motion_=now;motion_active_=true;
    const float scale=base_==ExpressionId::Idle ? 1.f : 0.55f;
    engine_.setTiltTarget(target.x*scale,target.y*scale,target.lead_x*scale,target.lead_y*scale);
}
