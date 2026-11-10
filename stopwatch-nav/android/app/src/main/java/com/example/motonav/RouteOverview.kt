package com.example.motonav

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import kotlin.math.*

/** Camera fitting in projected coordinates; circular padding includes marker/line width. */
object RouteOverview {
    const val SAFE_RADIUS = 198.0 // 480px image, 240px circle radius
    data class Camera(val lat:Double,val lng:Double,val zoom:Float)
    private fun mercator(lat:Double)=ln(tan(PI/4+Math.toRadians(lat)/2))
    fun points(route:WalkingRoute)=route.points+route.destination
    fun camera(route:WalkingRoute):Camera {
        val points=points(route)
        require(route.points.size>=2 && points.all {it.valid()})
        val west=points.minOf {it.lng};val east=points.maxOf {it.lng}
        val low=points.minOf {mercator(it.lat)};val high=points.maxOf {mercator(it.lat)}
        require(east-west<15 && Math.toDegrees(high-low)<15) {"路线范围过大，无法生成总览"}
        val lng=(west+east)/2;val y=(high+low)/2
        val lat=Math.toDegrees(2*atan(exp(y))-PI/2)
        val radius=points.maxOf {hypot(Math.toRadians(it.lng-lng),mercator(it.lat)-y)}.coerceAtLeast(.00002)
        val zoom=log2(SAFE_RADIUS*2*PI/(256*radius)).toFloat().coerceIn(3f,18f)
        return Camera(lat,lng,zoom)
    }
    fun radius(bounds:GeoBounds,route:WalkingRoute,size:Int=480):Double {
        require(bounds.valid(true))
        return points(route).maxOf {
            val p=RouteGeometry.project(bounds,it,size)
            hypot(p.first-size/2.0,p.second-size/2.0)
        }
    }
    fun fits(bounds:GeoBounds,route:WalkingRoute)=radius(bounds,route)<=SAFE_RADIUS+1
    fun adjustedZoom(zoom:Float,radius:Double):Float =
        (zoom+log2(SAFE_RADIUS/radius.coerceAtLeast(1.0))).toFloat().coerceIn(3f,18f)
    // Same bytes as QRTE offset64..end: destination followed by all route points.
    // Colour-only changes keep the image valid; a different route hides stale overlays.
    fun geometryKey(route:WalkingRoute):Long {
        val bytes=ByteBuffer.allocate((route.points.size+1)*16).order(ByteOrder.LITTLE_ENDIAN)
        (listOf(route.destination)+route.points).forEach {bytes.putDouble(it.lat).putDouble(it.lng)}
        return CRC32().apply {update(bytes.array())}.value
    }
    fun matches(image:MapPixels,route:WalkingRoute?,overview:Boolean):Boolean =
        if(overview) route!=null && image.overviewRoute===route else image.overviewRoute==null
}
