package com.example.motonav

import kotlin.math.*

/** MotoNav MapFeeder's confirmed coverage / ahead-of-motion strategy, adapted to LAN raster chunks. */
object MapChunkPolicy {
    const val SIZE=480
    const val WINDOW=240
    const val PREFETCH_MARGIN=60
    fun point(base:MapPixels,fix:PhoneFix)=base.bounds.pixel(fix.lat,fix.lng,base.size)
    fun covers(base:MapPixels,fix:PhoneFix):Boolean {
        val (x,y)=point(base,fix) ?: return false
        val half=WINDOW/2.0
        return x in half..base.size-half && y in half..base.size-half
    }
    fun needsRefresh(base:MapPixels,fix:PhoneFix):Boolean {
        val (x,y)=point(base,fix) ?: return true
        val edge=WINDOW/2.0+PREFETCH_MARGIN
        return x !in edge..base.size-edge || y !in edge..base.size-edge
    }
    fun origin(base:MapPixels,fix:PhoneFix?):Pair<Int,Int> {
        val p=fix?.let {point(base,it)} ?: (base.size/2.0 to base.size/2.0)
        val max=(base.size-WINDOW).coerceAtLeast(0)
        return (p.first-WINDOW/2).roundToInt().coerceIn(0,max) to
            (p.second-WINDOW/2).roundToInt().coerceIn(0,max)
    }
    fun target(current:PhoneFix,base:MapPixels?):PhoneFix {
        val bearing=current.bearing ?: return current
        if(base==null || !bearing.isFinite() || !current.speed.isFinite() || current.speed<1.4 || current.accuracy>25) return current
        // Reserve at most 40 source pixels ahead, so the current viewport still fits with prefetch margin.
        val metresPerPixel=(base.bounds.east-base.bounds.west)*111320*cos(Math.toRadians(current.lat))/base.size
        val metres=min(current.speed*20,metresPerPixel*40).coerceAtLeast(0.0)
        val a=Math.toRadians(bearing)
        val lat=current.lat+cos(a)*metres/111320
        val lng=current.lng+sin(a)*metres/(111320*cos(Math.toRadians(current.lat)))
        return if(lat in -84.0..84.0 && lng in -179.9..179.9) current.copy(lat=lat,lng=lng) else current
    }
}
