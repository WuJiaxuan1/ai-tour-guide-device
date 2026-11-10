package com.example.motonav

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/** P6 synthetic test image, RGB565 little endian; no geographic coordinates. */
object MapFrameEncoder {
    const val WIDTH = 240
    const val HEIGHT = 240
    const val HEADER = 48
    const val GEO_HEADER = 96
    const val PAYLOAD = WIDTH * HEIGHT * 2
    data class Frame(val bytes: ByteArray, val id: Int, val session: String, val crc: Long)

    fun encode(pixels: IntArray, id: Int, session: String, bounds: GeoBounds? = null): Frame {
        require(pixels.size == WIDTH * HEIGHT)
        require(id in 1..2_000_000_000 && session.matches(Regex("[0-9a-f]{32}")))
        require(bounds == null || bounds.valid())
        val header = if (bounds == null) HEADER else GEO_HEADER
        val bytes = ByteArray(header + PAYLOAD)
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        buffer.position(header)
        for (pixel in pixels) {
            val rgb565 = (((pixel ushr 19) and 31) shl 11) or
                (((pixel ushr 10) and 63) shl 5) or ((pixel ushr 3) and 31)
            buffer.putShort(rgb565.toShort())
        }
        val crc = CRC32().apply { update(bytes, header, PAYLOAD) }.value
        buffer.position(0)
        buffer.put(byteArrayOf(81, 77, 65, 80, 1, 1, 1, 0)) // QMAP, v1, synthetic, RGB565LE
        buffer.putShort(WIDTH.toShort()).putShort(HEIGHT.toShort())
        buffer.putInt(id).putInt(PAYLOAD).putInt(crc.toInt())
        for (i in session.indices step 2) buffer.put(session.substring(i, i + 2).toInt(16).toByte())
        if (bounds != null) {
            bytes[4] = 2; bytes[5] = 2
            buffer.position(48)
            buffer.putDouble(bounds.north).putDouble(bounds.west).putDouble(bounds.south).putDouble(bounds.east)
            buffer.put(1) // GCJ-02, north-up Web Mercator
        }
        return Frame(bytes, id, session, crc)
    }
}
