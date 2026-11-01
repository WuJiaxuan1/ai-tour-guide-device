package com.example.motonav

import android.content.SharedPreferences
import java.io.IOException

/** A successful save must survive process termination, not only update the RAM cache. */
class AmapKeyStore(private val preferences: SharedPreferences) {
    fun read(): String = preferences.getString("amap", "").orEmpty().trim()
    fun save(input: String): String {
        val key=input.trim()
        require(key.isNotEmpty() && key.none { it.isWhitespace() }) { "请输入完整的高德 Android Key，不要包含空格或换行" }
        if(!preferences.edit().putString("amap",key).remove("tdt").commit())
            throw IOException("Key 写入手机存储失败，请重试")
        if(read()!=key) throw IOException("Key 保存后校验失败，请重试")
        return key
    }
}
