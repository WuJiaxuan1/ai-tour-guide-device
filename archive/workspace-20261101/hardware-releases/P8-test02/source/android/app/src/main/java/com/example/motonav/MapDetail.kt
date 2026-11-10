package com.example.motonav
enum class MapDetail(val title:String,val showText:Boolean) {
    STANDARD("标准",true), CLEAN("隐藏地图文字",false);
    companion object { fun restore(value:String?)=entries.firstOrNull{it.name==value}?:CLEAN }
}
