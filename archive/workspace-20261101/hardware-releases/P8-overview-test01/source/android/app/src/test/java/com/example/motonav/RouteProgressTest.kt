package com.example.motonav

import org.junit.Assert.*
import org.junit.Test

class RouteProgressTest {
    private val route=WalkingRoute("终点",RoutePoint(32.0,118.802),listOf(RoutePoint(32.0,118.8),RoutePoint(32.0,118.802)),190,160)
    private fun fix(lng:Double,time:Long,accuracy:Double=5.0)=PhoneFix(32.0,lng,accuracy,time)
    @Test fun progressAdvancesOnRealFixesAndDoesNotRetreatOnBacktracking() {
        val tracker=RouteProgressTracker();tracker.setRoute(route)
        tracker.update(fix(118.8,0),0)
        tracker.update(fix(118.8005,10000),10000)
        assertEquals(.25,tracker.cursor,.001)
        tracker.update(fix(118.801,20000),20000)
        assertEquals(.5,tracker.cursor,.001)
        tracker.update(fix(118.8008,30000),30000)
        assertEquals(.5,tracker.cursor,.001)
    }
    @Test fun staleInaccurateAndOffRouteFixesFreezeProgress() {
        val tracker=RouteProgressTracker();tracker.setRoute(route)
        tracker.update(fix(118.8005,1000),1000);val before=tracker.cursor
        tracker.update(fix(118.801,2000,40.0),2000)
        tracker.update(fix(118.801,3000),30000)
        tracker.update(PhoneFix(32.01,118.801,5.0,40000),40000)
        tracker.update(null,50000)
        assertEquals(before,tracker.cursor,0.0)
    }
    @Test fun repeatedFixAndLargeJumpCannotPaintUnwalkedTail() {
        val long=route.copy(points=listOf(route.points.first(),RoutePoint(32.0,118.82)))
        val tracker=RouteProgressTracker();tracker.setRoute(long)
        tracker.update(fix(118.8002,0),0);val before=tracker.cursor
        repeat(100) {tracker.update(fix(118.8002,0),0)}
        tracker.update(fix(118.819,1000),1000)
        assertEquals(before,tracker.cursor,0.0)
    }
    @Test fun overlappingReturnLegDoesNotSkipToRouteEnd() {
        val loop=route.copy(points=listOf(route.points.first(),route.points.last(),route.points.first()))
        val tracker=RouteProgressTracker();tracker.setRoute(loop)
        tracker.update(fix(118.8002,0),0)
        tracker.update(fix(118.8004,10000),10000)
        assertTrue(tracker.cursor<1);assertTrue(tracker.meters<50)
    }
    @Test fun recolouringPreservesProgressButNewRouteAndCancelReset() {
        val tracker=RouteProgressTracker();tracker.setRoute(route);tracker.update(fix(118.801,1000),1000)
        val before=tracker.cursor;assertTrue(before>0)
        tracker.setRoute(route);assertEquals(before,tracker.cursor,0.0)
        tracker.setRoute(route.copy(name="重新规划"));assertEquals(0.0,tracker.cursor,0.0)
        tracker.update(fix(118.801,2000),2000);tracker.setRoute(null);assertEquals(0.0,tracker.cursor,0.0)
    }
    @Test fun previewSplitsOriginalSegmentBeforeClippingAndRetainsColourWithoutGps() {
        val base=MapPixels(IntArray(480*480){0xff204030.toInt()},GeoBounds(32.02,118.78,31.98,118.82),size=480)
        val across=route.copy(destination=RoutePoint(32.0,118.84),points=listOf(RoutePoint(32.0,118.76),RoutePoint(32.0,118.84)))
        val colors=RoutePalette(route=0xff00ff,traveled=0x00ffff)
        val half=MapPreviewPixels.render(base,null,across,colors,.5)
        assertEquals(0xff00ffff.toInt(),half[120*240+30]);assertEquals(0xffff00ff.toInt(),half[120*240+210])
        val more=MapPreviewPixels.render(base,null,across,colors,.54)
        assertEquals(0xff00ffff.toInt(),more[120*240+145]);assertEquals(0xffff00ff.toInt(),more[120*240+210])
    }
}
