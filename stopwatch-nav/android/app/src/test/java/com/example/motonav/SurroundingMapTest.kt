package com.example.motonav

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

class SurroundingMapTest {
    @Test fun projectsNorthUpAndRefreshesBeforeEdge() {
        val bounds=GeoBounds(32.01,118.79,32.0,118.80)
        assertTrue(bounds.valid())
        val (x,y)=bounds.pixel(32.005,118.795)!!
        assertEquals(120.0,x,1e-6);assertEquals(120.0,y,.1)
        assertTrue(bounds.pixel(32.006,118.795)!!.second<y)
        assertTrue(bounds.pixel(32.005,118.796)!!.first>x)
        assertFalse(bounds.needsRefresh(32.005,118.795))
        assertTrue(bounds.needsRefresh(32.005,118.7985))
        assertNull(bounds.pixel(32.02,118.795))
        assertFalse(GeoBounds(Double.NaN,118.79,32.0,118.8).valid())
        assertFalse(GeoBounds(32.0,118.79,32.01,118.8).valid())
    }
    @Test fun rejectsExpiredInaccurateAndFutureFixes() {
        val fix=PhoneFix(32.005,118.795,8.0,1000)
        assertTrue(fix.usable(16000));assertFalse(fix.usable(16001))
        assertFalse(fix.usable(999));assertFalse(fix.copy(accuracy=51.0).usable(1000))
        assertFalse(fix.copy(accuracy=Double.NaN).usable(1000))
        assertFalse(fix.copy(lat=Double.NaN).usable(1000))
        assertFalse(fix.copy(accuracy=0.0).usable(1000))
    }
    @Test fun convertsRawGpsExactlyOnceForAmap() {
        val wgs=doubleArrayOf(32.0,118.8)
        val gcj=MapGeo.wgsToGcj(wgs[0],wgs[1])
        assertTrue(kotlin.math.abs(gcj[1]-wgs[1])>.001)
        val back=MapGeo.gcjToWgs(gcj[0],gcj[1])
        assertEquals(wgs[0],back[0],.00001);assertEquals(wgs[1],back[1],.00001)
        assertArrayEquals(doubleArrayOf(40.0,-74.0),MapGeo.wgsToGcj(40.0,-74.0),0.0)
    }
    @Test fun exportsGeoFrameForActualFirmwareParser() {
        val bounds=GeoBounds(32.01,118.79,32.0,118.8)
        val frame=MapFrameEncoder.encode(IntArray(240*240){0xffff0000.toInt()},24,"0123456789abcdef0123456789abcdef",bounds)
        assertEquals(115296,frame.bytes.size)
        val buffer=ByteBuffer.wrap(frame.bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(2,frame.bytes[4].toInt());assertEquals(2,frame.bytes[5].toInt())
        assertEquals(bounds.north,buffer.getDouble(48),0.0);assertEquals(bounds.west,buffer.getDouble(56),0.0)
        assertEquals(bounds.south,buffer.getDouble(64),0.0);assertEquals(bounds.east,buffer.getDouble(72),0.0)
        assertEquals(1,frame.bytes[80].toInt());assertTrue(frame.bytes.copyOfRange(81,96).all {it==0.toByte()})
        assertEquals(frame.crc,CRC32().apply {update(frame.bytes,96,115200)}.value)
        val fixture=File(requireNotNull(System.getProperty("mapFrameFixture"))).resolveSibling("phone-geo-frame.bin")
        fixture.parentFile!!.mkdirs();fixture.writeBytes(frame.bytes)
    }
}
