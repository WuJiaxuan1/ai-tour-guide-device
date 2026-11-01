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
        previous_image_ = lv_image_create(map_);
        lv_obj_add_flag(previous_image_, LV_OBJ_FLAG_HIDDEN);
        route_layer_=lv_obj_create(map_);
        lv_obj_remove_style_all(route_layer_);lv_obj_set_size(route_layer_,width,height);
        lv_obj_remove_flag(route_layer_,LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_remove_flag(route_layer_,LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(route_layer_,DrawRoute,LV_EVENT_DRAW_MAIN,this);
        destination_=lv_obj_create(map_);lv_obj_remove_style_all(destination_);
        lv_obj_set_size(destination_,26,26);lv_obj_set_style_radius(destination_,4,0);
        lv_obj_set_style_bg_opa(destination_,LV_OPA_COVER,0);lv_obj_set_style_border_width(destination_,3,0);
        lv_obj_add_flag(destination_,LV_OBJ_FLAG_HIDDEN);
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
        if(!map) { lv_anim_delete(this, AnimateWindow); window_ready_=false; }
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
    void SetRoute(std::shared_ptr<const RouteWire::Frame> route) {
        if(route_==route) return;
        bool same=route_ && route && route_->active && route->active && route_->session==route->session &&
            route_->destination.lat==route->destination.lat && route_->destination.lng==route->destination.lng &&
            route_->points.size()==route->points.size();
        if(same) for(size_t i=0;i<route->points.size();++i) {
            if(route->points[i].lat!=route_->points[i].lat || route->points[i].lng!=route_->points[i].lng) {same=false;break;}
        }
        if(!same || (route->reset_progress && route->revision!=route_->revision)) route_progress_=0;
        route_=std::move(route);RebuildRoute();
    }
    bool SetImage(std::shared_ptr<MapFrame> frame) {
        if (!map_shown_ || !image_ || !frame || !frame->pixels) return false;
        const bool fade = frame->header.geo && !frame->header.chunk && frame_ && frame_->header.geo && !frame_->header.chunk && previous_image_;
        const bool carry=frame->header.chunk && frame_ && frame_->header.chunk && frame->header.session==frame_->header.session;
        lv_anim_delete(this, AnimateWindow);
        window_ready_=false; last_position_seq_=0;
        lv_anim_delete(this, AnimateImageOpacity);
        ClearPreviousImage();
        // Keep old pixels alive until LVGL's descriptor/cache has switched.
        lv_image_cache_drop(&image_descriptor_);
        if (fade) {
            previous_frame_ = std::move(frame_);
            previous_descriptor_ = image_descriptor_;
            lv_image_set_src(previous_image_, &previous_descriptor_);
            lv_obj_set_size(previous_image_, width_, height_);
            lv_image_set_inner_align(previous_image_, LV_IMAGE_ALIGN_STRETCH);
            lv_obj_align(previous_image_, LV_ALIGN_TOP_LEFT, 0, 0);
            lv_obj_set_style_opa(previous_image_, LV_OPA_COVER, 0);
            lv_obj_remove_flag(previous_image_, LV_OBJ_FLAG_HIDDEN);
            lv_obj_move_background(previous_image_);
        }
        // Keep storage alive until the old LVGL source/cache is detached.
        auto retired=std::move(frame_);
        frame_ = std::move(frame);
        image_descriptor_ = {};
        image_descriptor_.header.magic = LV_IMAGE_HEADER_MAGIC;
        image_descriptor_.header.cf = LV_COLOR_FORMAT_RGB565;
        image_descriptor_.header.w = frame_->header.size;
        image_descriptor_.header.h = frame_->header.size;
        image_descriptor_.header.stride = frame_->header.size * 2;
        image_descriptor_.data_size = frame_->header.Bytes();
        image_descriptor_.data = frame_->pixels.get();
        lv_image_set_src(image_, &image_descriptor_);
        const bool geo=frame_->header.geo;
        if(geo) {
            lv_obj_set_size(image_,width_*frame_->header.size/MapWire::kWidth,height_*frame_->header.size/MapWire::kHeight);
            lv_image_set_inner_align(image_,LV_IMAGE_ALIGN_STRETCH);
            lv_obj_align(image_,LV_ALIGN_TOP_LEFT,0,0);
            if(frame_->header.chunk) {
                point_x_=point_y_=frame_->header.size/2.0;
                if(carry) frame_->header.bounds.Project(last_lat_,last_lng_,point_x_,point_y_,frame_->header.size);
                ApplyWindow(point_x_,point_y_);
            }
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
        lv_obj_set_style_opa(image_, fade ? LV_OPA_TRANSP : LV_OPA_COVER, 0);
        lv_obj_add_flag(note_, LV_OBJ_FLAG_HIDDEN);
        lv_obj_invalidate(image_);
        lv_label_set_text(title_, geo ? "N" : "测试图 · 非真实地图");
        RebuildRoute();
        lv_obj_move_foreground(route_layer_);
        lv_obj_move_foreground(destination_);
        lv_obj_move_foreground(marker_);
        lv_obj_move_foreground(title_);
        lv_obj_move_foreground(gps_status_);
        lv_obj_add_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        if (fade) {
            lv_anim_t animation;
            lv_anim_init(&animation);
            lv_anim_set_var(&animation, this);
            lv_anim_set_values(&animation, LV_OPA_TRANSP, LV_OPA_COVER);
            lv_anim_set_duration(&animation, 360);
            lv_anim_set_exec_cb(&animation, AnimateImageOpacity);
            lv_anim_set_path_cb(&animation, lv_anim_path_ease_in_out);
            lv_anim_set_ready_cb(&animation, FinishImageFade);
            lv_anim_start(&animation);
        }
        return true;
    }
    void SetPosition(const MapWire::Position& position, int64_t now) {
        if (!marker_) return;
        if(map_shown_ && RouteMatches() && route_->active && position.route_revision==route_->revision &&
            std::isfinite(position.route_progress) && position.route_progress>=0 && position.route_progress<=route_->points.size()-1) {
            // Keep travelled colour when GPS becomes stale; progress belongs to the route, not the map frame.
            const double next=std::max(route_progress_,position.route_progress);
            if(next!=route_progress_) {route_progress_=next;lv_obj_invalidate(route_layer_);}
        }
        lv_obj_add_flag(marker_, LV_OBJ_FLAG_HIDDEN);
        if (!frame_ || !frame_->header.geo) {
            lv_label_set_text(gps_status_, frame_ ? "TEST IMAGE / NO GPS" : "GPS: waiting for phone"); return;
        }
        if (!map_shown_ || !position.Fresh(now)) {
            lv_anim_delete(this, AnimateWindow); window_ready_=false;
            lv_label_set_text(gps_status_, position.accuracy > 50 && position.valid ? "GPS: low accuracy" : "GPS: waiting / stale"); return;
        }
        double x=0,y=0;
        if (!frame_->header.bounds.Project(position.lat,position.lng,x,y,frame_->header.size)) {
            lv_anim_delete(this, AnimateWindow); window_ready_=false;
            lv_label_set_text(gps_status_, "GPS: waiting for new map"); return;
        }
        last_lat_=position.lat;last_lng_=position.lng;
        if(frame_->header.chunk) {
            if(!window_ready_ || position.seq!=last_position_seq_) {
                lv_anim_delete(this, AnimateWindow);
                if(window_ready_) {
                    from_x_=point_x_;from_y_=point_y_;to_x_=x;to_y_=y;
                    lv_anim_t animation;lv_anim_init(&animation);
                    lv_anim_set_var(&animation,this);lv_anim_set_values(&animation,0,1000);
                    lv_anim_set_duration(&animation,320);lv_anim_set_exec_cb(&animation,AnimateWindow);
                    lv_anim_set_path_cb(&animation,lv_anim_path_ease_in_out);lv_anim_start(&animation);
                } else ApplyWindow(x,y);
                window_ready_=true;last_position_seq_=position.seq;
            }
        } else {
            lv_obj_set_pos(marker_,int(std::lround(x*width_/MapWire::kWidth))-12,
                int(std::lround(y*height_/MapWire::kHeight))-12);
        }
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
    lv_obj_t* previous_image_ = nullptr;
    lv_obj_t* title_ = nullptr;
    lv_obj_t* marker_ = nullptr;
    lv_obj_t* gps_status_ = nullptr;
    lv_obj_t* return_hint_ = nullptr;
    lv_obj_t* route_layer_=nullptr;
    lv_obj_t* destination_=nullptr;
    std::shared_ptr<const RouteWire::Frame> route_;
    struct RouteSpan {RouteWire::Segment segment;size_t index;};
    std::vector<RouteSpan> segments_;
    double route_progress_=0;
    bool has_destination_=false;
    double destination_x_=0,destination_y_=0;
    int window_x_=0,window_y_=0;
    lv_image_dsc_t image_descriptor_{};
    lv_image_dsc_t previous_descriptor_{};
    std::shared_ptr<MapFrame> frame_;
    std::shared_ptr<MapFrame> previous_frame_;
    int width_ = 0;
    int height_ = 0;
    int offset_ = 0;
    bool map_shown_ = false;
    bool window_ready_ = false;
    uint32_t last_position_seq_=0;
    double last_lat_=0,last_lng_=0,point_x_=240,point_y_=240;
    double from_x_=0,from_y_=0,to_x_=0,to_y_=0;

    void ApplyWindow(double x,double y) {
        point_x_=x;point_y_=y;
        const auto window=MapWire::Window::At(x,y,frame_->header.size);
        window_x_=window.x;window_y_=window.y;
        lv_obj_set_pos(image_,-int(std::lround(window.x*double(width_)/MapWire::kWidth)),
            -int(std::lround(window.y*double(height_)/MapWire::kHeight)));
        lv_obj_set_pos(marker_,int(std::lround((x-window.x)*width_/MapWire::kWidth))-12,
            int(std::lround((y-window.y)*height_/MapWire::kHeight))-12);
        UpdateRouteWindow();
    }
    bool RouteMatches() const {return route_ && frame_ && frame_->header.geo && route_->session==frame_->header.session;}
    void RebuildRoute() {
        segments_.clear();has_destination_=false;
        const auto palette=RouteMatches()?route_->palette:RouteWire::Palette{};
        lv_obj_set_style_bg_color(marker_,lv_color_hex(palette.position),0);
        lv_obj_set_style_border_color(marker_,lv_color_hex(palette.outline),0);
        lv_obj_set_style_bg_color(destination_,lv_color_hex(palette.destination),0);
        lv_obj_set_style_border_color(destination_,lv_color_hex(palette.outline),0);
        if(frame_ && !frame_->header.chunk) window_x_=window_y_=0;
        if(RouteMatches() && route_->active) {
            const auto& bounds=frame_->header.bounds;
            auto project=[&](const RouteWire::Point& p) {
                return std::pair<double,double>{(p.lng-bounds.west)/(bounds.east-bounds.west)*frame_->header.size,
                    (MapWire::Bounds::Mercator(bounds.north)-MapWire::Bounds::Mercator(p.lat))/
                    (MapWire::Bounds::Mercator(bounds.north)-MapWire::Bounds::Mercator(bounds.south))*frame_->header.size};
            };
            for(size_t i=1;i<route_->points.size();++i) {
                auto a=project(route_->points[i-1]),b=project(route_->points[i]);
                RouteWire::Segment segment{a.first,a.second,b.first,b.second};
                auto clipped=segment;
                // Retain original endpoints: the progress fraction is defined before clipping.
                if(RouteWire::Clip(clipped,frame_->header.size)) segments_.push_back({segment,i-1});
            }
            auto end=project(route_->destination);destination_x_=end.first;destination_y_=end.second;
            has_destination_=destination_x_>=0&&destination_y_>=0&&destination_x_<frame_->header.size&&destination_y_<frame_->header.size;
        }
        UpdateRouteWindow();
    }
    void UpdateRouteWindow() {
        if(!route_layer_) return;
        lv_obj_invalidate(route_layer_);
        lv_obj_add_flag(destination_,LV_OBJ_FLAG_HIDDEN);
        if(has_destination_) {
            const double x=(destination_x_-window_x_)*width_/MapWire::kWidth,y=(destination_y_-window_y_)*height_/MapWire::kHeight;
            if(x>=0&&x<width_&&y>=0&&y<height_) {
                lv_obj_set_pos(destination_,int(std::lround(x))-13,int(std::lround(y))-13);
                lv_obj_remove_flag(destination_,LV_OBJ_FLAG_HIDDEN);
            }
        }
    }
    static void DrawRoute(lv_event_t* event) {
        auto* self=static_cast<StopwatchPages*>(lv_event_get_user_data(event));
        if(!self->RouteMatches() || !self->route_->active) return;
        lv_area_t area;lv_obj_get_coords(self->route_layer_,&area);
        auto* layer=lv_event_get_layer(event);
        const auto& palette=self->route_->palette;
        auto draw=[&](RouteWire::Segment segment,uint32_t color,int width) {
            lv_draw_line_dsc_t dsc;lv_draw_line_dsc_init(&dsc);
            dsc.color=lv_color_hex(color);dsc.width=width;
            dsc.round_start=dsc.round_end=1;
                segment.x0-=self->window_x_;segment.x1-=self->window_x_;
                segment.y0-=self->window_y_;segment.y1-=self->window_y_;
                if(!RouteWire::Clip(segment,MapWire::kWidth)) return;
                dsc.p1.x=area.x1+int(std::lround(segment.x0*self->width_/MapWire::kWidth));
                dsc.p1.y=area.y1+int(std::lround(segment.y0*self->height_/MapWire::kHeight));
                dsc.p2.x=area.x1+int(std::lround(segment.x1*self->width_/MapWire::kWidth));
                dsc.p2.y=area.y1+int(std::lround(segment.y1*self->height_/MapWire::kHeight));
                lv_draw_line(layer,&dsc);
        };
        for(const auto& span:self->segments_) draw(span.segment,palette.outline,palette.width+4);
        for(const auto& span:self->segments_) {
            const double cut=self->route_progress_-span.index;
            if(cut<=0) draw(span.segment,palette.route,palette.width);
            else if(cut>=1) draw(span.segment,palette.traveled,palette.width);
            else {
                auto a=span.segment,b=span.segment;
                a.x1=a.x0+(a.x1-a.x0)*cut;a.y1=a.y0+(a.y1-a.y0)*cut;
                b.x0=a.x1;b.y0=a.y1;
                draw(a,palette.traveled,palette.width);draw(b,palette.route,palette.width);
            }
        }
    }
    static void AnimateWindow(void* self,int32_t value) {
        auto* pages=static_cast<StopwatchPages*>(self);
        pages->ApplyWindow(pages->from_x_+(pages->to_x_-pages->from_x_)*value/1000.0,
                           pages->from_y_+(pages->to_y_-pages->from_y_)*value/1000.0);
    }

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
    static void AnimateImageOpacity(void* self, int32_t value) {
        auto* pages = static_cast<StopwatchPages*>(self);
        if (pages->image_) lv_obj_set_style_opa(pages->image_, static_cast<lv_opa_t>(value), 0);
    }
    static void FinishImageFade(lv_anim_t* animation) {
        auto* pages = static_cast<StopwatchPages*>(animation->var);
        if (!pages) return;
        pages->ClearPreviousImage();
        if (pages->image_) lv_obj_set_style_opa(pages->image_, LV_OPA_COVER, 0);
    }
    void ClearPreviousImage() {
        if (previous_image_) {
            lv_obj_add_flag(previous_image_, LV_OBJ_FLAG_HIDDEN);
            lv_image_set_src(previous_image_,nullptr);
        }
        lv_image_cache_drop(&previous_descriptor_);
        previous_frame_.reset();
        previous_descriptor_ = {};
    }
};
