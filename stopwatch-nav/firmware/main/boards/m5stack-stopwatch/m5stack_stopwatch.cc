#include "wifi_board.h"
#include "display/lcd_display.h"
#include "esp_lcd_co5300.h"
#include "codecs/es8311_audio_codec.h"
#include "application.h"
#include "button.h"
#include "M5IOE1.h"
#include "M5PM1.h"
#include "config.h"
#include "assets/lang_config.h"
#include <esp_log.h>
#include <driver/i2c_master.h>
#include <driver/spi_master.h>
#include <wifi_manager.h>
#include <ssid_manager.h>
#include "local_link_server.h"
#include "stopwatch_pages.h"
#include "swipe_tracker.h"

#define TAG "M5StackStopwatch"

// CO5300 AMOLED: brightness via 0x51 in init only, no separate backlight control
static const co5300_lcd_init_cmd_t vendor_specific_init[] = {
    // {cmd, { data }, data_size, delay_ms}
    {0xFE, (uint8_t []){0x00}, 0, 0},
    {0xC4, (uint8_t []){0x80}, 1, 0},
    {0x3A, (uint8_t []){0x55}, 0, 10}, // RGB565
    {0x35, (uint8_t []){0x00}, 0, 10},
    {0x53, (uint8_t []){0x20}, 1, 10},
    {0x51, (uint8_t []){0xFF}, 1, 10},
    {0x63, (uint8_t []){0xFF}, 1, 10},
    {0x2A, (uint8_t []){0x00, 0x00, 0x01, 0xD1}, 4, 0}, // Column address: 0-465
    {0x2B, (uint8_t []){0x00, 0x00, 0x01, 0xD1}, 4, 0}, // Row address: 0-465
    {0x11, (uint8_t []){0x00}, 0, 120}, // Exit sleep
    {0x29, (uint8_t []){0x00}, 0, 20},  // Display on
};

class RoundLcdDisplay : public SpiLcdDisplay {
private:
    lv_obj_t* local_link_label_ = nullptr;
    StopwatchPages pages_;
    std::string local_status_;
    int shown_volume_ = -1;
    void RefreshLocalStatus() {
        const auto text = local_status_ + "\nVOL " + std::to_string(shown_volume_);
        if (local_link_label_) lv_label_set_text(local_link_label_, text.c_str());
        pages_.SetStatus(text.c_str());
    }
public:
    std::function<MapWire::Position()> position_provider;
    std::function<std::shared_ptr<const RouteWire::Frame>()> route_provider;
    void RefreshRoute() {DisplayLockGuard lock(this);if(route_provider) pages_.SetRoute(route_provider());}
    void SetLocalLinkStatus(const std::string& text) {
        DisplayLockGuard lock(this);
        local_status_ = text;
        RefreshLocalStatus();
    }
    void UpdateStatusBar(bool update_all = false) override {
        SpiLcdDisplay::UpdateStatusBar(update_all);
        const int volume = Board::GetInstance().GetAudioCodec()->output_volume();
        DisplayLockGuard lock(this);
        if(route_provider) pages_.SetRoute(route_provider());
        if (position_provider) pages_.SetPosition(position_provider(), esp_timer_get_time()/1000);
        if (volume != shown_volume_) {
            shown_volume_ = volume;
            RefreshLocalStatus();
        }
    }
    void ShowMap(bool map) {
        DisplayLockGuard lock(this);
        pages_.ShowMap(map);
        if(route_provider) pages_.SetRoute(route_provider());
        if (position_provider) pages_.SetPosition(position_provider(), esp_timer_get_time()/1000);
    }
    bool ShowImage(std::shared_ptr<MapFrame> frame) {
        DisplayLockGuard lock(this);
        return pages_.SetImage(std::move(frame));
    }
    static void rounder_event_cb(lv_event_t* e) {
        lv_area_t* area = static_cast<lv_area_t*>(lv_event_get_param(e));
        area->x1 = (area->x1 >> 1) << 1;
        area->y1 = (area->y1 >> 1) << 1;
        area->x2 = ((area->x2 >> 1) << 1) + 1;
        area->y2 = ((area->y2 >> 1) << 1) + 1;
    }

    RoundLcdDisplay(esp_lcd_panel_io_handle_t io_handle,
                    esp_lcd_panel_handle_t panel_handle,
                    int width,
                    int height,
                    int offset_x,
                    int offset_y,
                    bool mirror_x,
                    bool mirror_y,
                    bool swap_xy)
        : SpiLcdDisplay(io_handle, panel_handle, width, height, offset_x, offset_y, mirror_x, mirror_y, swap_xy) {}

    void SetupUI() override {
        if (IsSetupUICalled()) return;
        SpiLcdDisplay::SetupUI();
        DisplayLockGuard lock(this);

        // Horizontal inset so labels stay inside the round mask
        lv_obj_set_style_pad_left(status_bar_, LV_HOR_RES * 0.2, 0);
        lv_obj_set_style_pad_right(status_bar_, LV_HOR_RES * 0.2, 0);

        // Status bar: upper half, below top icon bar (not at screen bottom)
        lv_obj_align(status_bar_, LV_ALIGN_TOP_MID, 0, DISPLAY_STATUS_BAR_TOP_OFF);
        lv_obj_set_width(status_label_, LV_HOR_RES * 0.6);
        lv_obj_set_width(notification_label_, LV_HOR_RES * 0.6);
        lv_obj_align(status_label_, LV_ALIGN_CENTER, 0, 0);
        lv_obj_align(notification_label_, LV_ALIGN_CENTER, 0, 0);

        // Chat/subtitle text: a bit higher, away from bottom arc
        if (bottom_bar_ != nullptr) {
            lv_obj_align(bottom_bar_, LV_ALIGN_BOTTOM_MID, 0, -DISPLAY_CHAT_BAR_BOTTOM_OFF);
            lv_obj_set_width(chat_message_label_, LV_HOR_RES * 0.75);
        }

        // emoji_box_: keep default LV_ALIGN_CENTER from SpiLcdDisplay::SetupUI()

        // Top icons: move the top bar down inside the round display safe area
        if (top_bar_ != nullptr) {
            lv_obj_align(top_bar_, LV_ALIGN_TOP_MID, 0, DISPLAY_ROUND_EDGE_INSET / 2);
            lv_obj_set_style_pad_top(top_bar_, DISPLAY_ROUND_EDGE_INSET / 4, 0);
        }

        lv_display_add_event_cb(display_, rounder_event_cb, LV_EVENT_INVALIDATE_AREA, NULL);
        local_link_label_ = lv_label_create(lv_screen_active());
        lv_obj_set_width(local_link_label_, 350);
        lv_obj_set_style_text_align(local_link_label_, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_text_font(local_link_label_, LV_FONT_DEFAULT, 0);
        lv_obj_set_style_text_color(local_link_label_, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_style_bg_color(local_link_label_, lv_color_hex(0x202020), 0);
        lv_obj_set_style_bg_opa(local_link_label_, LV_OPA_80, 0);
        lv_obj_set_style_radius(local_link_label_, 6, 0);
        lv_obj_align(local_link_label_, LV_ALIGN_TOP_MID, 0, 105);
        local_status_ = "P7: set up Wi-Fi on each boot";
        pages_.Initialize(lv_screen_active(), width_, height_);
        RefreshLocalStatus();
    }
};

class M5StackStopwatchBoard : public WifiBoard {
private:
    i2c_master_bus_handle_t i2c_bus_;
    M5PM1 pmic_;
    M5IOE1 ioe_;
    Button button1_;
    Button button2_;
    RoundLcdDisplay* display_;
    LocalLinkServer local_link_;
    std::string local_ip_;
    uint32_t local_received_ = 0;
    uint32_t local_seq_ = 0;
    bool startup_wifi_cleared_ = false;
    i2c_master_dev_handle_t touch_device_ = nullptr;

    void RequestPage(bool map) {
        Application::GetInstance().Schedule([this, map]() {
            if (!Application::GetInstance().SetVoicePaused(map)) return;
            local_link_.Images().SetActive(map);
            display_->ShowMap(map);
        });
    }

    void InitializeTouch() {
        // CST820B shares SYS_I2C; its reset is on the M5IOE1, not an ESP GPIO.
        ioe_.pinMode(IOE_PIN_TOUCH_RST, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_TOUCH_RST, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_TOUCH_RST, LOW);
        vTaskDelay(pdMS_TO_TICKS(20));
        ioe_.digitalWrite(IOE_PIN_TOUCH_RST, HIGH);
        vTaskDelay(pdMS_TO_TICKS(100));
        i2c_device_config_t config{};
        config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
        config.device_address = 0x15;
        config.scl_speed_hz = 100000;
        if (i2c_master_bus_add_device(i2c_bus_, &config, &touch_device_) != ESP_OK) return;
        uint8_t reg = 0xA7, chip = 0;
        if (i2c_master_transmit_receive(touch_device_, &reg, 1, &chip, 1, 40) != ESP_OK) {
            ESP_LOGW(TAG, "Touch unavailable; page buttons remain usable");
            return;
        }
        ESP_LOGI(TAG, "CST820 touch ID 0x%02x", chip);
        const uint8_t no_sleep[] = {0xFE, 0x01};
        if (i2c_master_transmit(touch_device_, no_sleep, sizeof(no_sleep), 40) != ESP_OK) {
            ESP_LOGW(TAG, "Touch auto-sleep setting failed; page buttons remain usable");
            return;
        }
        if (xTaskCreate([](void* arg) {
            auto* self = static_cast<M5StackStopwatchBoard*>(arg);
            SwipeTracker swipe;
            for (;;) {
                uint8_t reg = 0x02, point[5]{};
                bool valid = i2c_master_transmit_receive(self->touch_device_, &reg, 1, point, sizeof(point), 30) == ESP_OK;
                const int x = ((point[1] & 15) << 8) | point[2];
                const int y = ((point[3] & 15) << 8) | point[4];
                const bool pressed = point[0] == 1;
                valid = valid && point[0] <= 1 && (!pressed || (x < DISPLAY_WIDTH && y < DISPLAY_HEIGHT));
                const int direction = swipe.Update(valid, pressed, x, y, esp_timer_get_time() / 1000);
                if (direction) self->RequestPage(direction < 0);
                vTaskDelay(pdMS_TO_TICKS(30));
            }
        }, "stopwatch_touch", 3072, this, 2, nullptr) != pdPASS) {
            ESP_LOGW(TAG, "Touch task unavailable; page buttons remain usable");
        }
    }

    void UpdateLocalLinkLabel() {
        display_->SetLocalLinkStatus("P7 " + local_ip_ + ":8765\nRX #" +
            std::to_string(local_seq_) + "  total " + std::to_string(local_received_));
    }

    void InitializeI2c() {
        i2c_master_bus_config_t i2c_bus_cfg = {
            .i2c_port = I2C_NUM_0,
            .sda_io_num = AUDIO_CODEC_I2C_SDA_PIN,
            .scl_io_num = AUDIO_CODEC_I2C_SCL_PIN,
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .glitch_ignore_cnt = 7,
            .intr_priority = 0,
            .trans_queue_depth = 0,
            .flags = {.enable_internal_pullup = 1},
        };
        ESP_ERROR_CHECK(i2c_new_master_bus(&i2c_bus_cfg, &i2c_bus_));

        if (ioe_.begin(i2c_bus_, M5IOE1_I2C_ADDR, M5IOE1_I2C_FREQ_100K, M5IOE1_INT_MODE_POLLING) != M5IOE1_OK) {
            ESP_LOGE(TAG, "M5IOE1 begin failed");
            return;
        }

        if (pmic_.begin(i2c_bus_, M5PM1_DEFAULT_ADDR, M5PM1_I2C_FREQ_100K) != M5PM1_OK) {
            ESP_LOGE(TAG, "M5PM1 begin failed");
            return;
        }

        pmic_.setChargeEnable(true);
        pmic_.setBoostEnable(true);
        pmic_.pinMode(PMIC_PIN_CHARGE_STATE, INPUT);
        pmic_.pinMode(PMIC_PIN_CHARGE_PROG, OUTPUT);
        pmic_.digitalWrite(PMIC_PIN_CHARGE_PROG, LOW); // Set charge current to 425mA
    
        ioe_.pinMode(IOE_PIN_LCD_POWER, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_LCD_POWER, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_LCD_POWER, HIGH);

        ioe_.pinMode(IOE_PIN_LCD_RST, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_LCD_RST, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_LCD_RST, HIGH);

        ioe_.pinMode(IOE_PIN_CODEC_POWER, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_CODEC_POWER, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_CODEC_POWER, HIGH);

        ioe_.pinMode(IOE_PIN_PA_EN, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_PA_EN, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_PA_EN, HIGH);

        ioe_.pinMode(IOE_PIN_MOTOR, OUTPUT);
        ioe_.setDriveMode(IOE_PIN_MOTOR, M5IOE1_DRIVE_PUSHPULL);
        ioe_.digitalWrite(IOE_PIN_MOTOR, LOW);

        vTaskDelay(pdMS_TO_TICKS(100));
    }

    void InitializeSpi() {
        spi_bus_config_t buscfg = {};
        buscfg.sclk_io_num = DISPLAY_QSPI_SCK;
        buscfg.data0_io_num = DISPLAY_QSPI_D0;
        buscfg.data1_io_num = DISPLAY_QSPI_D1;
        buscfg.data2_io_num = DISPLAY_QSPI_D2;
        buscfg.data3_io_num = DISPLAY_QSPI_D3;
        buscfg.max_transfer_sz = DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint16_t);
        buscfg.flags = SPICOMMON_BUSFLAG_QUAD;
        ESP_ERROR_CHECK(spi_bus_initialize(DISPLAY_QSPI_HOST, &buscfg, SPI_DMA_CH_AUTO));
    }

    void InitializeDisplay() {
        ioe_.digitalWrite(IOE_PIN_LCD_RST, LOW);
        vTaskDelay(pdMS_TO_TICKS(10));
        ioe_.digitalWrite(IOE_PIN_LCD_RST, HIGH);
        vTaskDelay(pdMS_TO_TICKS(120));

        esp_lcd_panel_io_handle_t panel_io = nullptr;
        esp_lcd_panel_handle_t panel = nullptr;

        esp_lcd_panel_io_spi_config_t io_config = CO5300_PANEL_IO_QSPI_CONFIG(
            DISPLAY_QSPI_CS, nullptr, nullptr);
        ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi(DISPLAY_QSPI_HOST, &io_config, &panel_io));

        co5300_vendor_config_t vendor_config = {
            .init_cmds = &vendor_specific_init[0],
            .init_cmds_size = sizeof(vendor_specific_init) / sizeof(co5300_lcd_init_cmd_t),
            .flags = {.use_qspi_interface = 1},
        };

        esp_lcd_panel_dev_config_t panel_config = {};
        panel_config.reset_gpio_num = GPIO_NUM_NC;
        panel_config.rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB;
        panel_config.bits_per_pixel = 16;
        panel_config.vendor_config = &vendor_config;
        ESP_ERROR_CHECK(esp_lcd_new_panel_co5300(panel_io, &panel_config, &panel));

        esp_lcd_panel_set_gap(panel, 0x06, 0);
        esp_lcd_panel_reset(panel);
        esp_lcd_panel_init(panel);
        esp_lcd_panel_invert_color(panel, false);
        esp_lcd_panel_mirror(panel, DISPLAY_MIRROR_X, DISPLAY_MIRROR_Y);
        esp_lcd_panel_disp_on_off(panel, true);

        display_ = new RoundLcdDisplay(panel_io, panel, DISPLAY_WIDTH, DISPLAY_HEIGHT,
                                         DISPLAY_OFFSET_X, DISPLAY_OFFSET_Y,
                                         DISPLAY_MIRROR_X, DISPLAY_MIRROR_Y, DISPLAY_SWAP_XY);
    }

    void InitializeButtons() {
        // Button1 (GPIO2): left, return to voice. No action at left boundary.
        button1_.OnClick([this]() {
            RequestPage(false);
        });

        // Button2 (GPIO1): right, enter map. Provisioning/activation stays visible.
        button2_.OnClick([this]() {
            RequestPage(true);
        });
    }

public:
    M5StackStopwatchBoard()
        : i2c_bus_(nullptr),
          button1_(BUTTON1_GPIO),
          button2_(BUTTON2_GPIO),
          display_(nullptr),
          local_link_([this](uint32_t seq, uint32_t count) {
              Application::GetInstance().Schedule([this, seq, count]() {
                  local_seq_ = seq;
                  local_received_ = count;
                  if (WifiManager::GetInstance().IsConnected()) UpdateLocalLinkLabel();
              });
          }) {
        InitializeI2c();
        InitializeSpi();
        InitializeDisplay();
        InitializeButtons();
        display_->position_provider = [this]() { return local_link_.Images().Position(); };
        display_->route_provider=[this]() {return local_link_.Images().Route();};
        local_link_.OnImageReady([this]() {
            Application::GetInstance().Schedule([this]() {
                auto frame = local_link_.Images().Take();
                if (frame && display_->ShowImage(frame)) local_link_.Images().Displayed(*frame);
                display_->RefreshRoute();
            });
        });
        InitializeTouch();
    }

    void SetNetworkEventCallback(NetworkEventCallback callback) override {
        WifiBoard::SetNetworkEventCallback([this, callback](NetworkEvent event, const std::string& data) {
            if (event == NetworkEvent::Connected || event == NetworkEvent::Disconnected ||
                event == NetworkEvent::WifiConfigModeEnter) {
                Application::GetInstance().Schedule([this, event]() {
                    if (event == NetworkEvent::Connected && WifiManager::GetInstance().IsConnected()) {
                        local_ip_ = WifiManager::GetInstance().GetIpAddress();
                        if (local_link_.Start(local_ip_)) UpdateLocalLinkLabel();
                        else display_->SetLocalLinkStatus("P7: server error; restart device");
                    } else {
                        local_link_.Stop();
                        display_->SetLocalLinkStatus("P7: waiting for Wi-Fi");
                    }
                });
            }
            if (callback) callback(event, data);
        });
    }

    void StartNetwork() override {
        // Only the saved SSID/password keys are cleared. Reconnect and config
        // exit use WifiBoard::TryWifiConnect, never this reset operation.
        if (!startup_wifi_cleared_) {
            SsidManager::GetInstance().Clear();
            startup_wifi_cleared_ = true;
            ESP_LOGI(TAG, "P3: cleared saved Wi-Fi list for this boot; device identity preserved");
        }
        WifiBoard::StartNetwork();
    }

    AudioCodec* GetAudioCodec() override {
        static Es8311AudioCodec audio_codec(
            i2c_bus_,
            I2C_NUM_0,
            AUDIO_INPUT_SAMPLE_RATE,
            AUDIO_OUTPUT_SAMPLE_RATE,
            AUDIO_I2S_GPIO_MCLK,
            AUDIO_I2S_GPIO_BCLK,
            AUDIO_I2S_GPIO_WS,
            AUDIO_I2S_GPIO_DOUT,
            AUDIO_I2S_GPIO_DIN,
            AUDIO_CODEC_GPIO_PA,
            AUDIO_CODEC_ES8311_ADDR,
            false);
        return &audio_codec;
    }

    Display* GetDisplay() override {
        return display_;
    }

    bool GetBatteryLevel(int& level, bool& charging, bool& discharging) override {
        uint16_t voltage_mv = 0;
        if (pmic_.readVbat(&voltage_mv) != M5PM1_OK) {
            return false;
        }

        int charge_state_level = pmic_.digitalRead(PMIC_PIN_CHARGE_STATE);
        if (charge_state_level < 0) {
            // Charge status read failed; leave charging/discharging unknown
            charging = false;
            discharging = false;
        } else {
            // M5PM1 charge status is active low: 0 means charging, 1 means not charging
            charging = (charge_state_level == 0);
            discharging = !charging;
        }

        const int BATTERY_MIN_VOLTAGE = 3400;
        const int BATTERY_MAX_VOLTAGE = 4200;
        if (voltage_mv < BATTERY_MIN_VOLTAGE) {
            level = 0;
        } else if (voltage_mv > BATTERY_MAX_VOLTAGE) {
            level = 100;
        } else {
            level = ((voltage_mv - BATTERY_MIN_VOLTAGE) * 100) / (BATTERY_MAX_VOLTAGE - BATTERY_MIN_VOLTAGE);
        }
        return true;
    }
};

DECLARE_BOARD(M5StackStopwatchBoard);
