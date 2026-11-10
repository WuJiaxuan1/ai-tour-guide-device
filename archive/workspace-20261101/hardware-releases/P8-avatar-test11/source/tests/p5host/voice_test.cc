#include "voice_gate.h"
#include <cassert>
#include <condition_variable>
#include <cstdio>
#include <deque>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <vector>

#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#define TAG "test"
#define MAIN_EVENT_WAKE_WORD_DETECTED 1
#define MAIN_EVENT_TOGGLE_CHAT 2
#define MAIN_EVENT_START_LISTENING 4
#define MAIN_EVENT_SEND_AUDIO 8
void xEventGroupClearBits(int, int) {}
void esp_opus_dec_reset(void*) {}
enum DeviceState { kDeviceStateUnknown, kDeviceStateStarting, kDeviceStateWifiConfiguring,
    kDeviceStateIdle, kDeviceStateConnecting, kDeviceStateListening, kDeviceStateSpeaking,
    kDeviceStateActivating, kDeviceStateUpgrading };
enum { kAbortReasonNone, kListeningModeAutoStop, kListeningModeManualStop, kListeningModeRealtime };
namespace Lang {
namespace Strings { const char *STANDBY="idle", *CONNECTING="connect", *LISTENING="listen", *SPEAKING="speak"; }
namespace Sounds { const char* OGG_POPUP="sound"; }
}
struct FakeDisplay {
    void SetStatus(const char*) {} void ClearChatMessages() {} void SetEmotion(const char*) {}
    void SetChatMessage(const char*,const char*) {}
};
struct FakeLed { void OnStateChanged() {} };
struct Board {
    FakeDisplay display; FakeLed led;
    static Board& GetInstance() { static Board b; return b; }
    auto GetDisplay() { return &display; } auto GetLed() { return &led; }
};
struct StateMachine { DeviceState value=kDeviceStateIdle; DeviceState GetState() { return value; } };
struct FakeAudio {
    bool suspended=false, wake=true, recording=false; int suspends=0;
    void SetSuspended(bool p) { suspended=p; ++suspends; if(p) wake=recording=false; }
    void EnableVoiceProcessing(bool p) { recording=p; }
    void EnableWakeWordDetection(bool p) { wake=p; }
    bool IsAudioProcessorRunning() { return recording; }
    bool IsAfeWakeWord() { return false; }
    void WaitForPlaybackQueueEmpty() {} void ResetDecoder() {} void PlaySound(const char*) {}
};
struct Protocol {
    bool opened=true; int close=0, stop=0;
    bool IsAudioChannelOpened() { return opened; }
    void CloseAudioChannel() { opened=false; ++close; }
    void SendStopListening() { ++stop; } void SendStartListening(int) {}
};
struct Application {
    VoiceGate voice_gate_; std::atomic<bool> voice_channel_ready_{true};
    StateMachine state_machine_; FakeAudio audio_service_; std::unique_ptr<Protocol> protocol_{new Protocol};
    bool play_popup_on_listening_=true; int event_group_=0, clock_ticks_=0, listening_mode_=kListeningModeAutoStop;
    int aborted=0; std::vector<std::function<void()>> tasks;
    bool IsVoicePaused() { return voice_gate_.IsPaused(); }
    DeviceState GetDeviceState() { return state_machine_.value; }
    void SetDeviceState(DeviceState s) { state_machine_.value=s; }
    void AbortSpeaking(int) { ++aborted; }
    void Schedule(std::function<void()>&& f) { tasks.push_back(std::move(f)); }
    void Drain() { auto pending=std::move(tasks); tasks.clear(); for(auto& f:pending) f(); }
    bool SetVoicePaused(bool);
    void ScheduleVoice(std::function<void()>&&);
    void HandleStateChangedEvent();
};
#include "app_methods.inc"

enum AudioTaskType { kAudioTaskTypeEncodeToSendQueue, kAudioTaskTypeEncodeToTestingQueue };
struct AudioTask { AudioTaskType type; std::vector<int16_t> pcm; uint32_t timestamp=0, voice_ticket=0; };
struct AudioStreamPacket {};
constexpr int MAX_ENCODE_TASKS_IN_QUEUE=2, MAX_DECODE_PACKETS_IN_QUEUE=40, MAX_TIMESTAMPS_IN_QUEUE=3;
struct AudioService {
    VoiceGate voice_gate_; std::mutex audio_output_mutex_, audio_queue_mutex_, decoder_mutex_;
    std::condition_variable audio_queue_cv_; void* opus_decoder_=nullptr;
    std::deque<std::unique_ptr<AudioStreamPacket>> audio_decode_queue_,audio_send_queue_,audio_testing_queue_;
    std::deque<std::unique_ptr<AudioTask>> audio_encode_queue_,audio_playback_queue_;
    std::deque<uint32_t> timestamp_queue_;
    bool wake=true, recording=true, testing=false;
    void EnableWakeWordDetection(bool p) { wake=p; }
    void EnableVoiceProcessing(bool p) { recording=p; }
    void EnableAudioTesting(bool p) { testing=p; }
    void SetSuspended(bool); void ResetDecoder();
    void PushTaskToEncodeQueue(AudioTaskType,std::vector<int16_t>&&);
    bool PushPacketToDecodeQueue(std::unique_ptr<AudioStreamPacket>,bool wait=false);
};
#include "audio_methods.inc"

struct SavedVolumeCodec { int saved=24, value=0; void SetOutputVolume(int n) { saved=value=n; } };
struct StartupAudio {
    void Initialize(SavedVolumeCodec* c) { c->value=c->saved; }
    void Start() {}
};
void BootVolume(SavedVolumeCodec* codec) {
    StartupAudio audio_service_;
    #define CONFIG_BOARD_TYPE_M5STACK_STOPWATCH 1
    #include "boot_volume.inc"
}

int main() {
    Application app;
    for (auto state : {kDeviceStateStarting,kDeviceStateWifiConfiguring,kDeviceStateActivating,kDeviceStateUpgrading}) {
        app.SetDeviceState(state); assert(!app.SetVoicePaused(true)); assert(!app.IsVoicePaused());
    }
    app.SetDeviceState(kDeviceStateSpeaking);
    int late=0;
    app.ScheduleVoice([&]{ ++late; });
    assert(app.SetVoicePaused(true));
    assert(app.IsVoicePaused() && app.audio_service_.suspended && !app.audio_service_.recording && !app.audio_service_.wake);
    assert(app.protocol_->close==1 && app.protocol_->stop==1 && app.aborted==1);
    assert(app.GetDeviceState()==kDeviceStateIdle);
    app.HandleStateChangedEvent(); assert(!app.audio_service_.wake);
    app.ScheduleVoice([&]{ ++late; });
    app.SetVoicePaused(false);
    app.Drain(); assert(late==0); // pre-map callbacks still invalid after returning
    assert(app.audio_service_.wake && !app.protocol_->opened);
    app.ScheduleVoice([&]{ ++late; }); app.Drain(); assert(late==0); // old cloud messages cannot reopen chat
    app.voice_channel_ready_=true;
    app.ScheduleVoice([&]{ ++late; }); app.Drain(); assert(late==1);
    for(int i=0;i<20;++i) {
        app.SetVoicePaused(true); auto count=app.audio_service_.suspends;
        app.SetVoicePaused(true); assert(app.audio_service_.suspends==count);
        app.SetVoicePaused(false); assert(app.audio_service_.wake && !app.audio_service_.recording);
    }

    AudioService audio;
    auto ticket=audio.voice_gate_.Capture();
    audio.PushTaskToEncodeQueue(kAudioTaskTypeEncodeToSendQueue,{1,2});
    audio.PushPacketToDecodeQueue(std::make_unique<AudioStreamPacket>());
    audio.audio_send_queue_.push_back(std::make_unique<AudioStreamPacket>());
    audio.audio_playback_queue_.push_back(std::make_unique<AudioTask>());
    audio.SetSuspended(true);
    assert(!audio.wake && !audio.recording && !audio.testing);
    assert(audio.audio_send_queue_.empty() && audio.audio_encode_queue_.empty() && audio.audio_decode_queue_.empty() && audio.audio_playback_queue_.empty());
    assert(!audio.PushPacketToDecodeQueue(std::make_unique<AudioStreamPacket>()));
    audio.PushTaskToEncodeQueue(kAudioTaskTypeEncodeToSendQueue,{1,2});
    assert(audio.audio_encode_queue_.empty());
    audio.SetSuspended(false);
    assert(!audio.voice_gate_.Allows(ticket)); // already-decoding/popped old frame
    assert(audio.voice_gate_.Allows(audio.voice_gate_.Capture()));
    assert(audio.PushPacketToDecodeQueue(std::make_unique<AudioStreamPacket>()));

    // The suspend barrier must wait for an already-playing output frame.
    std::unique_lock<std::mutex> output(audio.audio_output_mutex_);
    auto stopping=std::async(std::launch::async,[&]{ audio.SetSuspended(true); });
    while(!audio.voice_gate_.IsPaused()) std::this_thread::yield();
    assert(stopping.wait_for(std::chrono::milliseconds(0)) != std::future_status::ready);
    output.unlock(); stopping.get();
    audio.SetSuspended(false);
    SavedVolumeCodec codec;
    BootVolume(&codec); assert(codec.value==85);
    codec.SetOutputVolume(30); assert(codec.value==30);
    BootVolume(&codec); assert(codec.value==85);
    puts("PASS: production application pause/resume, setup guards, stale callback rejection, fresh-session gate, 20 cycles; production audio queue flush/block/resume and output barrier; boot overrides saved volume to 85");
}
