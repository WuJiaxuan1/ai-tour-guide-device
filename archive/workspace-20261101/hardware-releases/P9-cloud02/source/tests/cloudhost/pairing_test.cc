#include "cloud_navigation.h"
#include "settings.h"
#include "esp_http_client.h"
#include "esp_timer.h"
#include <cassert>
#include <iostream>
struct CloudNavigationTest {
 static void Run(){
  Settings::values.clear();MapFrameMailbox images;int notifications=0;CloudNavigation cloud(images,[&]{++notifications;});cloud.SetOnline(true);
  const std::string token(43,'a'),trip="12345678-1234-1234-1234-123456789abc";
  auto config=cloud.config_;
  responses.push_back({"{\"claim_token\":\""+token+"\",\"pairing_code\":\"12345678\",\"expires_in_seconds\":300}"});cloud.PrepareCode(config);
  assert(requests.back().token.empty());assert(cloud.PairingCode().find("12345678")!=std::string::npos);assert(cloud.PairingCode().find(token)==std::string::npos);
  responses.push_back({"{\"bound\":false}"});assert(!cloud.CheckPairing(config));assert(!images.Status().active);
  // Code may have been entered just before expiry; the claim must still be polled.
  fake_time+=301000000;
  responses.push_back({"{\"bound\":true,\"trip_id\":\""+trip+"\"}"});assert(cloud.CheckPairing(config));assert(config.trip==trip&&config.claim);assert(Settings::values["token"]==token);
  assert(requests.back().token=="Bearer "+token);assert(cloud.pending_code_.empty());assert(notifications==1);
  CloudNavigation reboot(images,[]{});assert(reboot.config_.trip==trip&&reboot.config_.claim);assert(!reboot.request_code_);
  assert(cloud.PairingCode().find("preparing")!=std::string::npos);assert(cloud.request_code_);
  responses.push_back({"{}",401});assert(!cloud.CheckPairing(config));assert(Settings::values["token"].empty());
  assert(!cloud.Configure("http://public.example","",""));assert(cloud.Configure("http://192.168.1.2:8790","",""));
  config=cloud.config_;during_open=[&]{cloud.Configure("http://192.168.1.3:8790","","");};
  responses.push_back({"{\"claim_token\":\""+token+"\",\"pairing_code\":\"12345678\",\"expires_in_seconds\":300}"});cloud.PrepareCode(config);assert(cloud.pending_code_.empty());
  config=cloud.config_;responses.push_back({std::string(9000,'x')});cloud.PrepareCode(config);assert(cloud.pending_code_.empty());
  cloud.SetOnline(false);assert(cloud.PairingCode().find("offline")!=std::string::npos);assert(responses.empty());
  std::cout<<"PASS: production cloud pairing: chunked JSON, code-only tool output, late binding, NVS recovery, revocation, origin race and response bound\n";
 }
};
int main(){CloudNavigationTest::Run();}
