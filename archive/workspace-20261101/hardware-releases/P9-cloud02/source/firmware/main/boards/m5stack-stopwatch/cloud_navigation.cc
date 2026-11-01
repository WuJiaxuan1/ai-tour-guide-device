#include "cloud_navigation.h"
#ifdef ESP_PLATFORM
#include "settings.h"
#include <esp_http_client.h>
#include <esp_crt_bundle.h>
#include <esp_timer.h>
#include <cJSON.h>
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <memory>
#include <vector>

#ifndef WATCH_SERVER_ORIGIN
#define WATCH_SERVER_ORIGIN "https://43.160.252.245"
#endif
namespace {
using Json=std::unique_ptr<cJSON,decltype(&cJSON_Delete)>;
std::string String(cJSON* obj,const char* key){auto* value=cJSON_GetObjectItemCaseSensitive(obj,key);return cJSON_IsString(value)?value->valuestring:"";}
double Number(cJSON* obj,const char* key){auto* value=cJSON_GetObjectItemCaseSensitive(obj,key);return cJSON_IsNumber(value)?value->valuedouble:0;}
bool SafeOrigin(const std::string& s){
    if(s.size()>180 || s.find_first_of("\r\n?#@\\")!=std::string::npos)return false;
    if(s.rfind("https://",0)==0){auto host=s.substr(8);return !host.empty()&&host.find('/')==std::string::npos;}
    if(s.rfind("http://",0)!=0)return false;
    auto host=s.substr(7);if(host.find('/')!=std::string::npos)return false;
    auto colon=host.find(':');auto ip=host.substr(0,colon);unsigned a,b,c,d;char tail;
    if(sscanf(ip.c_str(),"%u.%u.%u.%u%c",&a,&b,&c,&d,&tail)!=4||a>255||b>255||c>255||d>255)return false;
    return a==10||(a==172&&b>=16&&b<=31)||(a==192&&b==168);
}
bool Hex(const std::string& s,size_t size){return s.size()==size&&std::all_of(s.begin(),s.end(),[](char c){return (c>='0'&&c<='9')||(c>='a'&&c<='f');});}
class Request {
    esp_http_client_handle_t handle_=nullptr;
public:
    ~Request(){if(handle_)esp_http_client_cleanup(handle_);}
    bool Open(const std::string& url,const std::string& token,const std::string& body=""){
        esp_http_client_config_t config{};config.url=url.c_str();config.timeout_ms=12000;config.crt_bundle_attach=esp_crt_bundle_attach;
        config.disable_auto_redirect=true;config.buffer_size=4096;config.buffer_size_tx=1024;
        handle_=esp_http_client_init(&config);if(!handle_)return false;
        if(!token.empty())esp_http_client_set_header(handle_,"Authorization",("Bearer "+token).c_str());
        esp_http_client_set_header(handle_,"Accept-Encoding","identity");
        esp_http_client_set_header(handle_,"Connection","close");
        if(!body.empty()){esp_http_client_set_method(handle_,HTTP_METHOD_POST);esp_http_client_set_header(handle_,"Content-Type","application/json");}
        if(esp_http_client_open(handle_,body.size())!=ESP_OK)return false;
        if(!body.empty()&&esp_http_client_write(handle_,body.data(),body.size())!=int(body.size()))return false;
        if(esp_http_client_fetch_headers(handle_)<0)return false;
        return esp_http_client_get_status_code(handle_)==200;
    }
    int Status(){return handle_?esp_http_client_get_status_code(handle_):0;}
    int64_t Length(){return esp_http_client_get_content_length(handle_);}
    bool Read(uint8_t* bytes,size_t size,const std::function<bool()>& current){
        size_t at=0;const auto deadline=esp_timer_get_time()+20000000;
        while(at<size){if(!current()||esp_timer_get_time()>deadline)return false;int n=esp_http_client_read(handle_,reinterpret_cast<char*>(bytes+at),std::min(size-at,size_t(4096)));if(n<=0)return false;at+=n;}return true;
    }
    std::string Text(){
        const auto length=Length();if(length>8192)return "";
        std::string out;char bytes[512];const auto deadline=esp_timer_get_time()+20000000;
        while(!esp_http_client_is_complete_data_received(handle_)){
            if(esp_timer_get_time()>deadline)return "";
            int n=esp_http_client_read(handle_,bytes,sizeof(bytes));
            if(n<0)return "";
            if(n==0){if(!esp_http_client_is_complete_data_received(handle_))return "";break;}
            out.append(bytes,n);if(out.size()>8192)return "";
        }
        return out;
    }
};
}
CloudNavigation::CloudNavigation(MapFrameMailbox& images,std::function<void()> notify):images_(images),notify_(std::move(notify)){
    Settings saved("watch_cloud");config_={saved.GetString("origin",WATCH_SERVER_ORIGIN),saved.GetString("trip"),saved.GetString("token"),1,saved.GetInt("claim",0)!=0};
    request_code_=config_.token.empty();
    running_=true;
    if(xTaskCreate([](void* self){static_cast<CloudNavigation*>(self)->Run();},"watch_cloud",8192,this,1,&task_)!=pdPASS){running_=false;state_="task_error";}
}
CloudNavigation::~CloudNavigation(){stopping_=true;online_=false;while(running_)vTaskDelay(pdMS_TO_TICKS(20));}
void CloudNavigation::SaveLocked(){
    Settings saved("watch_cloud",true);saved.SetString("origin",config_.origin);saved.SetString("trip",config_.trip);saved.SetString("token",config_.token);saved.SetInt("claim",config_.claim?1:0);
}
bool CloudNavigation::Configure(const std::string& origin,const std::string& trip,const std::string& token){
    std::string compact;for(char c:trip)if(c!='-')compact+=c;
    const bool originOnly=trip.empty()&&token.empty();
    if(!SafeOrigin(origin)||(!originOnly&&(trip.size()!=36||!Hex(compact,32)||token.size()!=43||!std::all_of(token.begin(),token.end(),[](unsigned char c){return std::isalnum(c)||c=='_'||c=='-';}))))return false;
    {std::lock_guard<std::mutex> lock(mutex_);config_={origin,trip,token,config_.generation+1,false};pending_code_.clear();pending_token_.clear();request_code_=originOnly;state_="configured";SaveLocked();}
    images_.Invalidate();notify_();return true;
}
std::string CloudNavigation::PairingCode(){
    std::lock_guard<std::mutex> lock(mutex_);
    if(!online_)return R"({"status":"offline","instruction":"请先让手表连接网络。"})";
    const auto seconds=(code_until_-esp_timer_get_time()/1000)/1000;
    if(!pending_code_.empty()&&seconds>10)return "{\"pairing_code\":\""+pending_code_+"\",\"expires_in_seconds\":"+std::to_string(seconds)+",\"instruction\":\"请逐位读出8位码，在网页连接我的枫叶精灵中填写；一次配对同时关联语音和地图。\"}";
    request_code_=true;
    return R"({"status":"preparing","instruction":"正在联网准备配对码，请稍后再次调用本工具查询。若仍未就绪，告知游客稍后再问；不要编造配对码。"})";
}
void CloudNavigation::PrepareCode(const Config& config){
    Request request;
    if(!SafeOrigin(config.origin)||!request.Open(config.origin+"/api/v1/watch/pairings","","{}")){State("pairing_connection_error");return;}
    Json reply(cJSON_Parse(request.Text().c_str()),cJSON_Delete);if(!reply)return;
    const auto token=String(reply.get(),"claim_token"),code=String(reply.get(),"pairing_code");
    if(token.size()!=43||!std::all_of(token.begin(),token.end(),[](unsigned char c){return std::isalnum(c)||c=='_'||c=='-';})||code.size()!=8||!std::all_of(code.begin(),code.end(),[](char c){return c>='0'&&c<='9';}))return;
    const auto ttl=Number(reply.get(),"expires_in_seconds");if(ttl<1||ttl>300)return;
    std::lock_guard<std::mutex> lock(mutex_);if(config_.generation!=config.generation)return;
    request_code_=false;pending_token_=token;pending_code_=code;code_until_=esp_timer_get_time()/1000+int64_t(ttl*1000);state_="waiting_pairing";
}
bool CloudNavigation::CheckPairing(Config& config){
    std::string token;bool pending=false;
    {std::lock_guard<std::mutex> lock(mutex_);
        if(code_until_<=esp_timer_get_time()/1000)pending_code_.clear();
        pending=!pending_token_.empty();token=pending?pending_token_:(config.claim?config.token:"");
    }
    if(token.empty())return !config.trip.empty();
    Request request;
    if(!request.Open(config.origin+"/api/v1/watch/pairing",token)){
        if(request.Status()==401||request.Status()==404||request.Status()==409){
            std::lock_guard<std::mutex> lock(mutex_);if(config_.generation!=config.generation)return false;
            if(pending){pending_token_.clear();pending_code_.clear();}
            else{config_.trip.clear();config_.token.clear();++config_.generation;SaveLocked();images_.Invalidate();notify_();}
            state_="pairing_expired";
        }
        return false;
    }
    Json reply(cJSON_Parse(request.Text().c_str()),cJSON_Delete);if(!reply)return false;
    if(!cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(reply.get(),"bound")))return !config.trip.empty();
    auto trip=String(reply.get(),"trip_id");std::string compact;for(char c:trip)if(c!='-')compact+=c;if(trip.size()!=36||!Hex(compact,32))return false;
    std::lock_guard<std::mutex> lock(mutex_);if(config_.generation!=config.generation)return false;
    if(pending){config_.trip=trip;config_.token=token;config_.claim=true;++config_.generation;pending_token_.clear();pending_code_.clear();request_code_=false;SaveLocked();images_.Invalidate();notify_();}
    config=config_;return true;
}
std::string CloudNavigation::State(){std::lock_guard<std::mutex> lock(mutex_);return state_;}
void CloudNavigation::State(const std::string& value){std::lock_guard<std::mutex> lock(mutex_);state_=value;}
bool CloudNavigation::Current(const Config& value,uint32_t ticket){std::lock_guard<std::mutex> lock(mutex_);return online_&&!stopping_&&config_.generation==value.generation&&images_.Current(ticket);}
void CloudNavigation::Run(){
    int64_t retry_at=0;
    while(!stopping_){Config config;bool prepare=false;{std::lock_guard<std::mutex> lock(mutex_);config=config_;if(online_&&request_code_&&esp_timer_get_time()>retry_at){prepare=true;request_code_=false;}}
        if(online_){
            if(prepare){PrepareCode(config);retry_at=esp_timer_get_time()+10000000;}
            if(CheckPairing(config)&&!config.token.empty()&&images_.Status().active)Poll(config);
        }
        for(int i=0;i<25&&!stopping_;i++)vTaskDelay(pdMS_TO_TICKS(100));
    }running_=false;vTaskDelete(nullptr);
}
void CloudNavigation::Poll(const Config& config){
    uint32_t ticket;if(!images_.Begin(ticket))return;
    const auto prefix="/api/v1/trips/"+config.trip+"/watch/";
    const auto current=[&]{return Current(config,ticket);};
    const int64_t request_at=esp_timer_get_time()/1000;
    std::string text;
    {Request request;if(!request.Open(config.origin+prefix+"navigation",config.token)){State("connection_error");images_.Invalidate();notify_();return;}text=request.Text();}
    Json manifest(cJSON_Parse(text.c_str()),cJSON_Delete);
    if(!manifest||!current()){State("response_error");return;}
    const auto state=String(manifest.get(),"status");State(state);
    if(state!="ready"){
        if(state=="paused"||state=="completed"||state=="finished"||state=="planned"||state=="preparing"||state=="waiting_location"||state=="error"){images_.Invalidate();notify_();}return;
    }
    const auto session=String(manifest.get(),"session");if(!Hex(session,32))return;
    const auto assetPrefix=prefix+"assets/"+session;
    // Paths are constructed locally; response data cannot redirect the bearer credential.
    auto status=images_.Status();
    if(status.session!=session||status.displayed!=1){
        Request image;if(!image.Open(config.origin+assetPrefix+"/map",config.token)||image.Length()!=MapWire::kGeoHeader+MapWire::kChunkBytes){State("map_download_error");return;}
        uint8_t header[MapWire::kGeoHeader];MapWire::Header parsed;
        if(!image.Read(header,sizeof(header),current)||!MapWire::Parse(header,image.Length(),parsed)||parsed.session!=session||!parsed.overview)return;
        auto frame=std::make_shared<MapFrame>(parsed.Bytes());frame->header=parsed;
        if(!frame->pixels||!image.Read(frame->pixels.get(),parsed.Bytes(),current)||MapWire::Crc32(frame->pixels.get(),parsed.Bytes())!=parsed.crc)return;
        if(!images_.Commit(frame,ticket))return;
        notify_();
        for(int i=0;i<100&&current()&&images_.Status().displayed!=1;i++)vTaskDelay(pdMS_TO_TICKS(20));
        // A new session may reuse frame ID 1: wait for the session too.
        for(int i=0;i<100&&current()&&images_.Status().session!=session;i++)vTaskDelay(pdMS_TO_TICKS(20));
    }
    status=images_.Status();if(!current()||status.pending||status.session!=session||status.displayed!=1)return;
    auto existing=images_.Route();
    if(!existing||existing->session!=session){
        Request requestRoute;if(!requestRoute.Open(config.origin+assetPrefix+"/route",config.token))return;
        auto size=requestRoute.Length();if(size<int64_t(RouteWire::kHeader)||size>int64_t(RouteWire::kMaxBytes))return;
        std::vector<uint8_t> bytes(size);auto route=std::make_shared<RouteWire::Frame>();
        if(!requestRoute.Read(bytes.data(),size,current)||!RouteWire::Parse(bytes.data(),size,*route)||route->session!=session||!images_.SetRoute(route,ticket))return;
        notify_();
    }
    auto* position=cJSON_GetObjectItemCaseSensitive(manifest.get(),"position");
    if(position&&current()){
        MapWire::Position p;p.seq=uint32_t(Number(position,"seq"));p.valid=cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(position,"valid"));p.lat=Number(position,"lat");p.lng=Number(position,"lng");p.accuracy=Number(position,"accuracy");
        p.received_ms=esp_timer_get_time()/1000;p.age_ms=std::min(3600000.0,Number(position,"age_ms")+double(p.received_ms-request_at));p.route_revision=1;p.route_progress=Number(position,"route_progress");
        if(std::isfinite(p.lat)&&std::isfinite(p.lng)&&std::isfinite(p.accuracy)&&std::abs(p.lat)<85&&std::abs(p.lng)<=180)images_.SetPosition(1,session,p);
    }
    Request ack;ack.Open(config.origin+prefix+"ack",config.token,"{\"session\":\""+session+"\",\"frame_id\":1,\"route_revision\":1}");State("installed");
}
#endif

