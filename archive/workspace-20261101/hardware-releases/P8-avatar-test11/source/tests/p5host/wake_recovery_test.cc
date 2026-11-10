#include "device_state.h"
#include "voice_gate.h"
#include <atomic>
#include <cstdio>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#define CONFIG_SEND_WAKE_WORD_DATA 1
#define MAIN_EVENT_WAKE_WORD_DETECTED 1
#define MAIN_EVENT_TOGGLE_CHAT 2
#define MAIN_EVENT_START_LISTENING 4
#define MAIN_EVENT_SEND_AUDIO 8
void xEventGroupClearBits(int, int) {}
enum ListeningMode {kListeningModeAutoStop, kListeningModeManualStop, kListeningModeRealtime};
enum {kAbortReasonNone, kAbortReasonWakeWordDetected};
enum class PowerSaveLevel {PERFORMANCE};
namespace Lang {
namespace Strings {const char *STANDBY="idle", *CONNECTING="connecting", *LISTENING="listening", *SPEAKING="speaking";}
namespace Sounds {const char* OGG_POPUP="popup";}
}
struct Display {void SetStatus(const char*) {} void ClearChatMessages() {} void SetEmotion(const char*) {} void SetChatMessage(const char*,const char*) {}};
struct Led {void OnStateChanged() {}};
struct Board {
    Display display; Led led;
    static Board& GetInstance() {static Board board;return board;}
    Display* GetDisplay() {return &display;} Led* GetLed() {return &led;}
    void SetPowerSaveLevel(PowerSaveLevel) {}
};
struct Audio {
    bool wake=true,recording=false,suspended=false;
    std::string word="枫叶精灵";
    void EnableWakeWordDetection(bool enabled) {wake=enabled;}
    void EnableVoiceProcessing(bool enabled) {recording=enabled;}
    void SetSuspended(bool paused) {suspended=paused;if(paused) wake=recording=false;}
    bool IsAudioProcessorRunning() {return recording;}
    bool IsAfeWakeWord() {return false;}
    void WaitForPlaybackQueueEmpty() {} void ResetDecoder() {} void PlaySound(const char*) {}
    void EncodeWakeWord() {}
    const std::string& GetLastWakeWord() {return word;}
    std::unique_ptr<int> PopWakeWordPacket() {return nullptr;}
    std::unique_ptr<int> PopPacketFromSendQueue() {return nullptr;}
};
struct Protocol {
    bool opened=false,fail_open=false;
    int attempts=0,notifications=0,listens=0;
    bool IsAudioChannelOpened() {return opened;}
    bool OpenAudioChannel() {++attempts;return opened=!fail_open;}
    void CloseAudioChannel() {opened=false;}
    void SendAudio(std::unique_ptr<int>) {}
    void SendWakeWordDetected(const std::string&) {++notifications;}
    void SendStartListening(ListeningMode) {++listens;}
    void SendStopListening() {}
};
struct StateMachine {DeviceState value=kDeviceStateIdle;DeviceState GetState() {return value;}};
struct Application {
    VoiceGate voice_gate_;bool voice_channel_ready_=true,play_popup_on_listening_=false;
    StateMachine state_machine_;Audio audio_service_;std::unique_ptr<Protocol> protocol_{new Protocol};
    int event_group_=0,clock_ticks_=0;
    ListeningMode listening_mode_=kListeningModeAutoStop;
    std::vector<std::function<void()>> tasks;
    bool IsVoicePaused() {return voice_gate_.IsPaused();}
    DeviceState GetDeviceState() {return state_machine_.value;}
    bool SetDeviceState(DeviceState state) {state_machine_.value=state;return true;}
    void Schedule(std::function<void()>&& task) {tasks.push_back(std::move(task));}
    void Drain() {auto pending=std::move(tasks);tasks.clear();for(auto& task:pending) task();}
    void AbortSpeaking(int) {}
    ListeningMode GetDefaultListeningMode() const {return kListeningModeAutoStop;}
    void SetListeningMode(ListeningMode);
    void HandleStateChangedEvent();bool SetVoicePaused(bool);
    void HandleWakeWordDetectedEvent();void ContinueWakeWordInvoke(const std::string&);
    void ContinueOpenAudioChannel(ListeningMode);void WakeWordInvoke(const std::string&);
    // The recognizer stops itself when it reports a detection, as on the device.
    void Detect() {audio_service_.wake=false;HandleWakeWordDetectedEvent();Drain();HandleStateChangedEvent();}
};
#include "wake_app.inc"

struct Model {bool dirty=true;int resets=0;};
struct ModelApi {void clean(Model* model) {model->dirty=false;++model->resets;}};
struct CustomWakeWord {
    std::atomic<bool> running_{false};std::mutex input_buffer_mutex_;std::vector<int16_t> input_buffer_;
    Model model;ModelApi api;Model* multinet_model_data_=&model;ModelApi* multinet_=&api;
    void Start();void Stop();
};
#include "wake_model.inc"

int main() {
    int failures=0;
    auto check=[&](bool ok,const char* label) {printf("%s: %s\n",ok?"PASS":"FAIL",label);if(!ok) ++failures;};
    for(bool opened:{false,true}) {
        Application app;app.protocol_->opened=opened;app.Detect();
        check(app.GetDeviceState()==kDeviceStateListening && app.protocol_->notifications==1 &&
              app.audio_service_.recording && app.protocol_->attempts==(opened?0:1),
              opened?"idle wake reuses open channel and enters listening":"cold wake opens channel and enters listening");
    }
    {
        Application app;app.protocol_->opened=true;app.WakeWordInvoke("枫叶精灵");app.Drain();
        check(app.GetDeviceState()==kDeviceStateListening && app.protocol_->notifications==1,"external wake entry also reuses open channel");
    }
    {
        Application app;app.protocol_->fail_open=true;app.Detect();
        check(app.GetDeviceState()==kDeviceStateIdle && app.audio_service_.wake,"failed connection returns idle and rearms wake");
        app.protocol_->fail_open=false;app.Detect();
        check(app.GetDeviceState()==kDeviceStateListening,"retry after connection failure needs no reboot or page change");
    }
    {
        Application app;app.SetDeviceState(kDeviceStateConnecting);app.HandleStateChangedEvent();
        check(!app.audio_service_.wake,"button connection disables detector until normal voice state resumes");
        app.protocol_->fail_open=true;app.ContinueOpenAudioChannel(kListeningModeAutoStop);app.HandleStateChangedEvent();
        check(app.GetDeviceState()==kDeviceStateIdle && app.audio_service_.wake,"failed left-button connection restores wake standby");
    }
    {
        Application app;app.audio_service_.wake=false;app.HandleWakeWordDetectedEvent();
        app.SetVoicePaused(true);app.Drain();
        check(app.protocol_->attempts==0 && !app.audio_service_.wake,"map cancels deferred wake connection");
        app.SetVoicePaused(false);app.Detect();
        check(app.GetDeviceState()==kDeviceStateListening,"fresh wake after map return works");
    }
    {
        Application app;app.audio_service_.wake=false;app.HandleWakeWordDetectedEvent();
        app.SetVoicePaused(true);app.SetVoicePaused(false);app.HandleWakeWordDetectedEvent();app.Drain();
        check(app.protocol_->notifications==1 && app.protocol_->attempts==1,"old wake ticket cannot act on a new post-map connection");
    }
    {
        Application app;bool ok=true;
        for(int i=0;i<20;++i) {
            app.SetDeviceState(kDeviceStateIdle);app.HandleStateChangedEvent();app.Detect();
            ok &= app.GetDeviceState()==kDeviceStateListening;
            app.SetDeviceState(kDeviceStateSpeaking);app.HandleStateChangedEvent();
            app.SetVoicePaused(true);app.HandleStateChangedEvent();ok &= !app.audio_service_.wake;
            app.SetVoicePaused(false);ok &= app.audio_service_.wake;
        }
        check(ok,"20 conversation/map/return/wake cycles");
    }
    {
        CustomWakeWord wake;wake.input_buffer_={1,2};wake.Start();
        check(wake.running_ && !wake.model.dirty && wake.input_buffer_.empty(),"restart clears stale acoustic state and partial input");
        wake.model.dirty=true;wake.input_buffer_={3};wake.Stop();
        check(!wake.running_ && wake.input_buffer_.empty(),"stop excludes future feed and clears partial input");
        wake.Start();check(!wake.model.dirty && wake.running_,"map resume starts a fresh recognition window");
    }
    if(!failures) puts("PASS: avatar10 production wake recovery and recognizer lifecycle");
    return failures?1:0;
}
