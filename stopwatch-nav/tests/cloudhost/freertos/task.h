#pragma once
inline int xTaskCreate(void(*)(void*),const char*,int,void*,int,TaskHandle_t*){return 0;}
inline void vTaskDelay(int){}
inline void vTaskDelete(void*){}
