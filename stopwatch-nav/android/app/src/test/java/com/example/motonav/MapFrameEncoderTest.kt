package com.example.motonav

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

class MapFrameEncoderTest {
    @Test fun packsRgb565AndHeaderAndExportsFirmwareFixture() {
        val session = "0123456789abcdef0123456789abcdef"
        val pixels = IntArray(240 * 240) { 0xff000000.toInt() }
        pixels[0] = 0xffff0000.toInt(); pixels[1] = 0xff00ff00.toInt(); pixels[2] = 0xff0000ff.toInt()
        val frame = MapFrameEncoder.encode(pixels, 23, session)
        assertEquals(115248, frame.bytes.size)
        assertArrayEquals(byteArrayOf(0, 0xf8.toByte(), 0xe0.toByte(), 7, 31, 0), frame.bytes.copyOfRange(48, 54))
        val header = ByteBuffer.wrap(frame.bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals("QMAP", String(frame.bytes, 0, 4, Charsets.US_ASCII))
        assertEquals(240, header.getShort(8).toInt()); assertEquals(240, header.getShort(10).toInt())
        assertEquals(23, header.getInt(12)); assertEquals(115200, header.getInt(16))
        val crc = CRC32().apply { update(frame.bytes, 48, 115200) }.value
        assertEquals(crc, header.getInt(20).toLong() and 0xffffffffL)
        assertTrue(frame.bytes.copyOfRange(40, 48).all { it == 0.toByte() })
        val fixture = File(requireNotNull(System.getProperty("mapFrameFixture")))
        fixture.parentFile.mkdirs(); fixture.writeBytes(frame.bytes)
    }

    @Test fun rejectsWrongDimensionsAndIds() {
        val valid = IntArray(240 * 240)
        for (block in listOf<() -> Unit>(
            { MapFrameEncoder.encode(IntArray(2), 1, "0".repeat(32)) },
            { MapFrameEncoder.encode(valid, 0, "0".repeat(32)) },
            { MapFrameEncoder.encode(valid, 1, "invalid") }
        )) {
            try { block(); fail("Expected invalid frame rejection") } catch (_: IllegalArgumentException) { }
        }
    }
}
