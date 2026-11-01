package com.example.motonav

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** P2 transport. No Android UI or process-wide network binding. */
class LocalLinkClient(private val baseUrl: String) {
    data class Status(val firmware: String, val bootId: String, val received: Long, val lastSeq: Long,
        val imageProtocol: Int = 0, val mapActive: Boolean = false, val displayedImage: Long = 0,
        val imageSession: String = "", val geoProtocol: Int = 0, val chunkProtocol: Int = 0,
        val routeProtocol: Int=0,val routeRevision: Long=0,val routeSession: String="",val progressProtocol:Int=0)
    data class Ack(val bootId: String, val received: Long, val elapsedMs: Long)
    data class ImageAck(val bootId: String, val elapsedMs: Long)
    private val cancelled = AtomicBoolean(false)
    private val active = AtomicReference<HttpURLConnection?>(null)

    fun cancel() {
        cancelled.set(true)
        active.getAndSet(null)?.disconnect()
    }

    fun status(): Status {
        val json = request("/api/v1/status", null)
        validateEnvelope(json)
        return Status(json.getString("firmware"), bootId(json), integer(json, "received_count"), integer(json, "last_seq"),
            if (json.has("image_protocol")) integer(json, "image_protocol").toInt() else 0,
            json.optBoolean("map_active"), if (json.has("image_displayed_id")) integer(json, "image_displayed_id") else 0,
            json.optString("image_session"), if(json.has("geo_protocol")) integer(json,"geo_protocol").toInt() else 0,
            if(json.has("chunk_protocol")) integer(json,"chunk_protocol").toInt() else 0,
            if(json.has("route_protocol")) integer(json,"route_protocol").toInt() else 0,
            if(json.has("route_revision")) integer(json,"route_revision") else 0,json.optString("route_session"),
            if(json.has("route_progress_protocol")) integer(json,"route_progress_protocol").toInt() else 0)
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

    fun uploadImage(frame: MapFrameEncoder.Frame): ImageAck {
        require(frame.bytes.size in listOf(MapFrameEncoder.HEADER + MapFrameEncoder.PAYLOAD, MapFrameEncoder.GEO_HEADER + MapFrameEncoder.PAYLOAD, MapFrameEncoder.GEO_HEADER + MapFrameEncoder.CHUNK_PAYLOAD))
        val start = System.nanoTime()
        val json = requestBytes("/api/v1/image", frame.bytes, "application/octet-stream")
        validateEnvelope(json)
        if (json.optString("type") != "image_received" || json.optString("state") != "queued" ||
            json.optString("session") != frame.session || integer(json, "frame_id") != frame.id.toLong() ||
            integer(json, "crc32") != frame.crc) throw IOException("图像接收确认与本次发送不匹配")
        return ImageAck(bootId(json), (System.nanoTime() - start) / 1_000_000)
    }

    fun position(session: String, frameId: Int, sequence: Int, fix: PhoneFix?, now: Long,
                 routeRevision:Int=0,routeProgress:Double=0.0): String {
        require(session.matches(Regex("[0-9a-f]{32}")) && frameId in 1..2_000_000_000 && sequence in 1..2_000_000_000)
        val valid = fix?.usable(now) == true
        val body = JSONObject().put("protocol",1).put("session",session).put("frame_id",frameId).put("seq",sequence)
            .put("valid",valid).put("lat",if(valid) fix!!.lat else 0.0).put("lng",if(valid) fix!!.lng else 0.0)
            .put("accuracy",if(valid) fix!!.accuracy else 0.0).put("age_ms",fix?.age(now) ?: 0)
        if(routeRevision!=0) {
            require(routeRevision in 1..2_000_000_000 && routeProgress.isFinite() && routeProgress in 0.0..2047.0)
            body.put("route_revision",routeRevision).put("route_progress",kotlin.math.round(routeProgress*1_000_000)/1_000_000)
        }
        val json=request("/api/v1/position",body)
        validateEnvelope(json)
        if(json.optString("type")!="position_received" || json.optString("session")!=session ||
            integer(json,"frame_id")!=frameId.toLong() || integer(json,"seq")!=sequence.toLong())
            throw IOException("位置确认与当前地图不匹配")
        if(routeRevision!=0 && (integer(json,"route_revision")!=routeRevision.toLong() ||
            kotlin.math.abs(json.optDouble("route_progress",Double.NaN)-body.getDouble("route_progress")).let {!it.isFinite() || it>0.000001}))
            throw IOException("路线进度确认不匹配")
        return bootId(json)
    }

    fun uploadRoute(frame:RouteWire.Frame): String {
        val json=requestBytes("/api/v1/route",frame.bytes,"application/octet-stream")
        validateEnvelope(json)
        if(json.optString("type")!="route_received" || json.optString("session")!=frame.session ||
            integer(json,"revision")!=frame.revision.toLong() || integer(json,"crc32")!=frame.crc)
            throw IOException("路线接收确认不匹配")
        return bootId(json)
    }

    private fun request(path: String, body: JSONObject?): JSONObject =
        requestBytes(path, body?.toString()?.toByteArray(Charsets.UTF_8), "application/json; charset=utf-8")

    private fun requestBytes(path: String, bytes: ByteArray?, contentType: String): JSONObject {
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
            if (bytes != null) {
                require(bytes.size <= MapFrameEncoder.GEO_HEADER + MapFrameEncoder.CHUNK_PAYLOAD)
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", contentType)
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { output ->
                    var offset = 0
                    while (offset < bytes.size) {
                        checkActive()
                        val size = minOf(4096, bytes.size - offset)
                        output.write(bytes, offset, size)
                        offset += size
                    }
                }
            }
            val deadline = System.nanoTime() + 5_000_000_000L
            val code = connection.responseCode
            if (code != 200) throw IOException(when (code) {
                409 -> "请先把手表切到地图页，等待上一张处理完成后再发送"
                400 -> "图像或消息校验失败，手表保留上一张图"
                408 -> "接收中断或切页，手表保留上一张图"
                503 -> "手表图像内存暂不可用"
                else -> "设备返回 HTTP $code，请确认固件版本和 IP"
            })
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
