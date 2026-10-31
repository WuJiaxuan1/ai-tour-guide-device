package com.example.motonav

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.*

class RouteOverviewTest {
    private val session="0123456789abcdef0123456789abcdef"
    private val route=WalkingRoute("终点",RoutePoint(31.995,118.81),listOf(
        RoutePoint(32.005,118.79),RoutePoint(32.005,118.81),RoutePoint(31.995,118.81)),2000,1500)
    private val bounds=GeoBounds(32.02,118.78,31.98,118.82)
    private fun image(r:WalkingRoute=route)=MapPixels(IntArray(480*480){i->
        if(i%480<240) 0xff204030.toInt() else 0xff304020.toInt()
    },bounds,size=480,overviewRoute=r)
    @Test fun cameraFitsDiagonalLongShortAndFlatRoutesInCircle() {
        val variants=listOf(route,route.copy(points=listOf(RoutePoint(32.0,118.8),RoutePoint(32.0,118.80001)),destination=RoutePoint(32.0,118.80001)),
            route.copy(points=listOf(RoutePoint(31.0,118.0),RoutePoint(33.0,120.0))),
            route.copy(points=listOf(RoutePoint(32.0,118.7),RoutePoint(32.0,118.9))),
            route.copy(points=listOf(RoutePoint(31.8,118.8),RoutePoint(32.2,118.8))))
        for(r in variants) {
            val c=RouteOverview.camera(r)
            fun merc(lat:Double)=ln(tan(PI/4+Math.toRadians(lat)/2))
            fun lat(y:Double)=Math.toDegrees(2*atan(exp(y))-PI/2)
            val delta=240*2*PI/(256*2.0.pow(c.zoom.toDouble()))
            val b=GeoBounds(lat(merc(c.lat)+delta),c.lng+Math.toDegrees(-delta),lat(merc(c.lat)-delta),c.lng+Math.toDegrees(delta))
            assertTrue("route must fit circular viewport",RouteOverview.fits(b,r))
        }
        assertTrue(RouteOverview.adjustedZoom(14f,396.0)<14f)
        assertTrue(RouteOverview.adjustedZoom(14f,99.0)>14f)
    }
    @Test fun geometryIdentityAndCaptureGenerationAreIndependentOfPalette() {
        assertEquals(RouteOverview.geometryKey(route),RouteOverview.geometryKey(route.copy(name="另一个名字")))
        assertNotEquals(RouteOverview.geometryKey(route),RouteOverview.geometryKey(route.copy(destination=RoutePoint(32.0,118.8))))
        assertTrue(RouteOverview.matches(image(),route,true))
        assertFalse(RouteOverview.matches(image(),route.copy(),true))
        assertFalse(RouteOverview.matches(image(),null,false))
        assertFalse(RouteOverview.matches(image(),null,true))
    }
    @Test fun wireFixtureAndBroadBoundsOnlyAllowedForOverview() {
        val frame=MapFrameEncoder.encode(image().pixels,40,session,bounds,480,route)
        val b=ByteBuffer.wrap(frame.bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(4,b.get(4).toInt());assertEquals(4,b.get(5).toInt())
        assertEquals(RouteOverview.geometryKey(route).toInt(),b.getInt(84))
        val file=File(requireNotNull(System.getProperty("mapFrameFixture"))).resolveSibling("phone-overview-frame.bin")
        file.parentFile!!.mkdirs();file.writeBytes(frame.bytes)
        file.resolveSibling("phone-overview-route.bin").writeBytes(RouteWire.encode(route,RoutePalette(),40,session).bytes)
        val broad=GeoBounds(33.0,117.8,31.0,119.8)
        assertTrue(broad.valid(true));assertFalse(broad.valid())
        MapFrameEncoder.encode(image().pixels,41,session,broad,480,route)
        try {MapFrameEncoder.encode(image().pixels,41,session,broad,480);fail("legacy broad bounds")} catch(_:IllegalArgumentException) {}
        try {MapFrameEncoder.encode(image().pixels,41,session,GeoBounds(32.001,118.799,31.999,118.801),480,route);fail("clipped route")} catch(_:IllegalArgumentException) {}
    }
    @Test fun overviewKeepsFullBasemapAndRouteWhilePositionMoves() {
        val palette=RoutePalette(route=0xff00ff,traveled=0x00ffff,position=0xffff00)
        val base=image()
        val a=MapPreviewPixels.render(base,PhoneFix(32.0,118.8,5.0,0),route,palette,0.0)
        val b=MapPreviewPixels.render(base,PhoneFix(32.0,118.805,5.0,0),route,palette,.5)
        assertEquals(a[180*240+110],b[180*240+110])
        assertEquals(0xff000000.toInt(),a[0])
        assertTrue(a.contains(0xff48da73.toInt()));assertTrue(a.contains(0xffff00ff.toInt()))
        assertTrue(b.contains(0xff00ffff.toInt()));assertTrue(b.contains(0xffffff00.toInt()))
        val stale=MapPreviewPixels.render(base,null,route,palette,.5)
        assertTrue(stale.contains(0xff00ffff.toInt()));assertFalse(stale.contains(0xffffff00.toInt()))
        val changed=route.copy(destination=RoutePoint(32.0,118.8))
        assertFalse(MapPreviewPixels.render(base,null,changed,palette).contains(0xffff00ff.toInt()))
        assertTrue(base.pixels.none {it==0xffff00ff.toInt()})
    }
}
