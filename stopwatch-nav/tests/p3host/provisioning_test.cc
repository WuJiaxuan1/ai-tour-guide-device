// Compile the real SsidManager, actual board StartNetwork method and actual
// /submit lambda against NVS/HTTP shims. No device or real credentials used.
#include "ssid_manager.h"
#include "provisioning_request.h"
#include "nvs_flash.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <algorithm>
#include <cassert>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <set>

static std::map<std::string, std::map<std::string, std::string>> storage;
static std::map<int, std::string> handles;
static std::set<std::string> written_namespaces;
static int commits = 0, handle_count = 0, base_starts = 0;
esp_err_t nvs_open(const char* name, int mode, nvs_handle_t* handle) {
    if (mode == NVS_READONLY && !storage.count(name)) return ESP_ERR_NVS_NOT_FOUND;
    storage[name]; *handle = ++handle_count; handles[*handle] = name; return ESP_OK;
}
esp_err_t nvs_get_str(nvs_handle_t handle, const char* key, char* value, size_t* length) {
    auto& ns = storage[handles.at(handle)];
    if (!ns.count(key)) return ESP_ERR_NVS_NOT_FOUND;
    const auto& text = ns.at(key);
    if (*length < text.size() + 1) return ESP_FAIL;
    memcpy(value, text.c_str(), text.size() + 1); *length = text.size() + 1; return ESP_OK;
}
esp_err_t nvs_set_str(nvs_handle_t handle, const char* key, const char* value) {
    written_namespaces.insert(handles.at(handle)); storage[handles.at(handle)][key] = value; return ESP_OK;
}
esp_err_t nvs_erase_key(nvs_handle_t handle, const char* key) {
    written_namespaces.insert(handles.at(handle)); storage[handles.at(handle)].erase(key); return ESP_OK;
}
esp_err_t nvs_commit(nvs_handle_t) { ++commits; return ESP_OK; }
void nvs_close(nvs_handle_t handle) { handles.erase(handle); }

struct WifiBoard { virtual ~WifiBoard() = default; virtual void StartNetwork() { ++base_starts; } };
struct BoardUnderTest : WifiBoard {
    bool startup_wifi_cleared_ = false;
    #include "boot_network.inc"
};
struct WifiConfigurationAp {
    int connect_attempts = 0, saves = 0;
    bool ConnectToWifi(const std::string&, const std::string&) { ++connect_attempts; return false; }
    void Save(const std::string& ssid, const std::string& password) { ++saves; SsidManager::GetInstance().AddSsid(ssid, password); }
};
constexpr int HTTPD_400_BAD_REQUEST = 400, HTTPD_500_INTERNAL_SERVER_ERROR = 500;
esp_err_t httpd_resp_set_type(httpd_req_t*, const char*) { return ESP_OK; }
esp_err_t httpd_resp_set_hdr(httpd_req_t*, const char*, const char*) { return ESP_OK; }
esp_err_t httpd_resp_send(httpd_req_t* req, const char* text, int length) {
    req->response.assign(text, length < 0 ? strlen(text) : length); return ESP_OK;
}
int httpd_req_recv(httpd_req_t* req, char* buffer, size_t size) {
    if (req->fail_recv) return -1;
    auto count = std::min({size, req->chunk, req->body.size() - req->cursor});
    memcpy(buffer, req->body.data() + req->cursor, count); req->cursor += count; return count;
}
esp_err_t httpd_resp_send_err(httpd_req_t* req, int status, const char* message) {
    req->status = std::to_string(status); req->response = message; return ESP_OK;
}
esp_err_t httpd_resp_send_408(httpd_req_t* req) { req->status = "408"; return ESP_OK; }
#include "submit_handler.inc"

int main() {
    storage["wifi"] = {{"ssid", "old-network"}, {"password", "old-password"}, {"unrelated_setting", "keep"}};
    storage["board"] = {{"uuid", "KEEP_UUID"}};
    storage["mqtt"] = {{"token", "FAKE_KEEP_TOKEN"}};
    storage["settings"] = {{"volume", "70"}};
    const auto original = storage;
    auto& ssids = SsidManager::GetInstance();
    assert(ssids.GetSsidList().size() == 1);
    BoardUnderTest board;
    board.StartNetwork();
    assert(ssids.GetSsidList().empty() && commits == 1 && base_starts == 1);
    assert(storage["wifi"].size() == 1 && storage["wifi"].at("unrelated_setting") == "keep");

    WifiConfigurationAp ap;
    auto submit = [&](const std::string& body, bool fail = false) {
        httpd_req_t req; req.content_len = body.size(); req.body = body; req.user_ctx = &ap; req.fail_recv = fail;
        SubmitHandler(&req); return req;
    };
    auto saved = submit(R"({"ssid":"not-yet-enabled","password":"hotspot-pass"})");
    assert(ap.saves == 1 && ap.connect_attempts == 0);
    auto* reply = cJSON_Parse(saved.response.c_str()); assert(reply);
    assert(cJSON_IsTrue(cJSON_GetObjectItem(reply, "saved")));
    assert(cJSON_IsFalse(cJSON_GetObjectItem(reply, "connected"))); cJSON_Delete(reply);
    assert(ssids.GetSsidList().front().ssid == "not-yet-enabled");
    const int after_save = commits;
    board.StartNetwork();
    assert(commits == after_save && ssids.GetSsidList().size() == 1 && base_starts == 2);
    assert(submit("broken JSON").response.find("false") != std::string::npos);
    assert(submit(R"({"ssid":"x","password":"short"})").response.find("false") != std::string::npos);
    assert(submit(std::string(1025, 'x')).status == "400");
    assert(submit(R"({"ssid":"x","password":"12345678"})", true).status == "408");
    assert(commits == after_save && ap.saves == 1);

    stopwatch_provisioning::Credentials result;
    std::string error;
    auto parse = [&](const std::string& body) { return stopwatch_provisioning::Parse(body.data(), body.size(), result, error); };
    assert(parse(R"({"ssid":"maple","password":""})"));
    assert(parse("{\"ssid\":\"" + std::string(32,'s') + "\",\"password\":\"" + std::string(64,'a') + "\"}"));
    for (const auto& body : {std::string("{}"), std::string(R"({"ssid":"","password":""})"),
         std::string(R"({"ssid":"x","password":7})"), std::string(R"({"ssid":"x","password":"12345678"})") + "junk",
         "{\"ssid\":\"" + std::string(33,'s') + "\",\"password\":\"\"}",
         "{\"ssid\":\"x\",\"password\":\"" + std::string(64,'z') + "\"}",
         "{\"nested\":" + std::string(100,'[') + "0" + std::string(100,']') + "}"}) assert(!parse(body));

    BoardUnderTest next_boot;
    next_boot.StartNetwork();
    assert(ssids.GetSsidList().empty() && commits == after_save + 1);
    assert(storage["board"] == original.at("board") && storage["mqtt"] == original.at("mqtt"));
    assert(storage["settings"] == original.at("settings"));
    assert(written_namespaces == std::set<std::string>{"wifi"});
    std::cout << "PASS: actual boot reset is once per boot; new credentials survive repeated network start; next boot clears again; identity namespaces preserved; actual fragmented submit saves without connecting; invalid inputs do not save\n";
}
