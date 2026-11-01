package com.example.motonav

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** P2 transport. No Android UI or process-wide network binding. */
class LocalLinkClient(private val baseUrl: String) {
    data class Status(val firmware: String, val bootId: String, val received: Long, val lastSeq: Long)
    data class Ack(val bootId: String, val received: Long, val elapsedMs: Long)
    private val cancelled = AtomicBoolean(false)
    private val active = AtomicReference<HttpURLConnection?>(null)

    fun cancel() {
        cancelled.set(true)
        active.getAndSet(null)?.disconnect()
    }

    fun status(): Status {
        val json = request("/api/v1/status", null)
        validateEnvelope(json)
        return Status(json.getString("firmware"), bootId(json), integer(json, "received_count"), integer(json, "last_seq"))
    }

    fun ping(session: String, sequence: Int, message: String = "手机链路测试"): Ack {
        require(session.matches(Regex("[0-9a-f]{32}")))
        require(sequence in 1..2_000_000_000)
        require(message.toByteArray(Charsets.UTF_8).size <= 96)
        val body = JSONObject().put("protocol", 1).put("type", "ping")
            .put("session", session).put("seq", sequence).put("message", message)
        val start = System.nanoTime()
        val json = request("/api/v1/echo", body)
        validateEnvelope(json)
        if (json.optString("type") != "ack" || json.optString("session") != session ||
            integer(json, "seq") != sequence.toLong() || json.optString("message") != message) {
            throw IOException("手表确认与本次消息不匹配")
        }
        return Ack(bootId(json), integer(json, "received_count"), (System.nanoTime() - start) / 1_000_000)
    }

    private fun request(path: String, body: JSONObject?): JSONObject {
        checkActive()
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        active.set(connection)
        try {
            checkActive()
            connection.connectTimeout = 2500
            connection.readTimeout = 2500
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.setRequestProperty("Connection", "close")
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                require(bytes.size <= 384)
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }
            val deadline = System.nanoTime() + 5_000_000_000L
            val code = connection.responseCode
            if (code != 200) throw IOException("设备返回 HTTP $code，请确认使用 P2 固件和正确 IP")
            if (connection.contentLengthLong > 4096) throw IOException("设备响应过大")
            val data = java.io.ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(512)
                while (true) {
                    checkActive()
                    if (System.nanoTime() > deadline) throw IOException("设备响应超时")
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (data.size() + count > 4096) throw IOException("设备响应过大")
                    data.write(buffer, 0, count)
                }
            }
            checkActive()
            return try { JSONObject(data.toString("UTF-8")) }
            catch (error: Exception) { throw IOException("设备没有返回有效 JSON", error) }
        } finally {
            active.compareAndSet(connection, null)
            connection.disconnect()
        }
    }

    private fun checkActive() {
        if (cancelled.get() || Thread.currentThread().isInterrupted) throw IOException("连接已停止")
    }

    private fun validateEnvelope(json: JSONObject) {
        if (json.optString("service") != "qixia-stopwatch" || integer(json, "protocol") != 1L) {
            throw IOException("目标不是兼容的 StopWatch 本地服务")
        }
    }

    private fun bootId(json: JSONObject): String = json.optString("boot_id").also {
        if (!it.matches(Regex("[0-9a-f]{16}"))) throw IOException("设备启动标识无效")
    }

    private fun integer(json: JSONObject, key: String): Long {
        val number = json.opt(key) as? Number ?: throw IOException("设备响应缺少 $key")
        val value = number.toDouble()
        if (!value.isFinite() || value < 0 || value > 4_294_967_295.0 || value != kotlin.math.floor(value)) {
            throw IOException("设备响应中的 $key 无效")
        }
        return value.toLong()
    }

    companion object {
        fun address(input: String): String {
            val parts = input.trim().split('.')
            require(parts.size == 4 && parts.all { p ->
                p.isNotEmpty() && p.length <= 3 && p.all { it in '0'..'9' } && (p.toIntOrNull() ?: -1) in 0..255
            }) { "请输入手表显示的 IPv4 地址，例如 192.168.43.123，不要填写端口" }
            val values = parts.map { it.toInt() }
            require(values[0] in 1..223 && values[0] != 127) { "请输入手表的局域网 IP" }
            return "http://${values.joinToString(".")}:8765"
        }
    }
}
