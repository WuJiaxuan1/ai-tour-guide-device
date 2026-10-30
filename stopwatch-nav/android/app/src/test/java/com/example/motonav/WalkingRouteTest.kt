package com.example.motonav

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

class WalkingRouteTest {
    private val session="0123456789abcdef0123456789abcdef"
    private val route=WalkingRoute("测试终点",RoutePoint(32.005,118.805),listOf(RoutePoint(32.005,118.76),RoutePoint(32.005,118.84)),2000,1500)
    @Test fun binaryFixtureProtectsMetadataAndCoordinates() {
        val frame=RouteWire.encode(route,RoutePalette(route=0xff00ff),7,session)
        val b=ByteBuffer.wrap(frame.bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(112,frame.bytes.size);assertEquals(2,b.getInt(12));assertEquals(7,b.getInt(8))
        assertEquals(32.005,b.getDouble(64),0.0);assertEquals(0xff00ff,b.getInt(40))
        val copy=frame.bytes.clone();ByteBuffer.wrap(copy).order(ByteOrder.LITTLE_ENDIAN).putInt(20,0)
        assertEquals(frame.crc,CRC32().apply {update(copy)}.value)
        val file=File(requireNotNull(System.getProperty("mapFrameFixture"))).resolveSibling("phone-route-frame.bin")
        requireNotNull(file.parentFile).mkdirs();file.writeBytes(frame.bytes)
        file.resolveSibling("phone-route-clear.bin").writeBytes(RouteWire.encode(null,RoutePalette(position=0xffff00),8,session).bytes)
        val reset=RouteWire.encode(route,RoutePalette(),9,session,resetProgress=true)
        val resetBytes=reset.bytes.clone()
        val resetBuffer=ByteBuffer.wrap(resetBytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(1,resetBuffer.getShort(62).toInt());assertEquals(0,b.getShort(62).toInt())
        resetBuffer.putInt(20,0)
        assertEquals(reset.crc,CRC32().apply {update(resetBytes)}.value)
    }
    @Test fun validatesBoundsAndPaletteWithoutTruncation() {
        for(action in listOf<()->Unit>(
            {RouteWire.encode(route.copy(points=List(2049){RoutePoint(32.0,118.8)}),RoutePalette(),1,session)},
            {RouteWire.encode(route.copy(destination=RoutePoint(Double.NaN,118.8)),RoutePalette(),1,session)},
            {RouteWire.encode(route,RoutePalette(route=-1),1,session)},
            {RouteWire.encode(route,RoutePalette(width=17),1,session)},
            {RouteWire.encode(route,RoutePalette(),0,session)})) {
            try {action();fail("invalid route accepted")} catch(_:IllegalArgumentException) {}
        }
    }
    @Test fun simplificationPreservesEndpointsAndBends() {
        val points=(0..3000).map {RoutePoint(32.0,118.8+it*.000001)}+RoutePoint(32.01,118.803)
        val result=RouteWire.simplify(points)
        assertEquals(3,result.size);assertEquals(points.first(),result.first());assertEquals(points.last(),result.last())
        assertEquals(points[3000],result[1])
    }
    @Test fun crossingSegmentsAreClippedWithoutInventingConnections() {
        assertArrayEquals(doubleArrayOf(0.0,100.0,240.0,100.0),RouteGeometry.clip(-100.0,100.0,300.0,100.0,240.0),.001)
        assertNull(RouteGeometry.clip(-100.0,-10.0,300.0,-10.0,240.0))
        assertNull(RouteGeometry.clip(250.0,0.0,250.0,240.0,240.0))
    }
    @Test fun overlayChangesDoNotAlterBasemapOrRequireNewImage() {
        val bounds=GeoBounds(32.02,118.78,31.98,118.82)
        val base=MapPixels(IntArray(480*480){0xff204030.toInt()},bounds,size=480)
        val fix=PhoneFix(32.0,118.8,5.0,0)
        val a=MapPreviewPixels.render(base,fix,route,RoutePalette(route=0xff00ff,position=0xffff00))
        assertEquals(0xffffff00.toInt(),a[120*240+120]);assertTrue(a.contains(0xffff00ff.toInt()))
        val b=MapPreviewPixels.render(base,fix,null,RoutePalette(position=0x00ffff))
        assertFalse(b.contains(0xffff00ff.toInt()));assertTrue(base.pixels.all {it==0xff204030.toInt()})
    }
    @Test fun realPositionSplitsRouteAndDistantFixDoesNotRecolourIt() {
        val points=listOf(RoutePoint(32.0,118.8),RoutePoint(32.0,118.81),RoutePoint(32.0,118.82))
        val half=RouteGeometry.match(points,PhoneFix(32.0,118.81,5.0,0))!!
        assertEquals(.5,half.progress,.02);assertTrue(half.distanceMeters<1)
        assertNull(RouteGeometry.match(points,PhoneFix(32.02,118.81,5.0,0)))
    }
}
