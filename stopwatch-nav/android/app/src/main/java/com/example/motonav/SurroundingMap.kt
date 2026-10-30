package com.example.motonav

import kotlin.math.*

/** Phone-rendered map contract; a future server can provide the same result. */
data class GeoBounds(val north: Double, val west: Double, val south: Double, val east: Double) {
    fun valid() = listOf(north,west,south,east).all { it.isFinite() } &&
        north < 85 && south > -85 && west >= -180 && east <= 180 &&
        north > south && east > west && north-south < .1 && east-west < .1
    fun pixel(lat: Double, lng: Double, size: Int = 240): Pair<Double,Double>? {
        if (!valid() || !lat.isFinite() || !lng.isFinite() || lat !in south..north || lng !in west..east) return null
        fun mercator(v: Double) = ln(tan(PI/4 + Math.toRadians(v)/2))
        return ((lng-west)/(east-west)*size) to
            ((mercator(north)-mercator(lat))/(mercator(north)-mercator(south))*size)
    }
    fun needsRefresh(lat: Double, lng: Double): Boolean {
        val (x,y) = pixel(lat,lng) ?: return true
        return x !in 60.0..180.0 || y !in 60.0..180.0
    }
}

data class PhoneFix(val lat: Double, val lng: Double, val accuracy: Double, val elapsedMs: Long,
                    val speed: Double = 0.0, val bearing: Double? = null) {
    fun age(now: Long) = (now-elapsedMs).coerceAtLeast(0).coerceAtMost(3_600_000).toInt()
    fun usable(now: Long) = now >= elapsedMs && age(now) <= 15_000 &&
        lat.isFinite() && lng.isFinite() && lat in -84.9..84.9 && lng in -180.0..180.0 &&
        accuracy.isFinite() && accuracy > 0 && accuracy <= 50
}

data class MapPixels(val pixels: IntArray, val bounds: GeoBounds, val zoom: Float = MapZoom.DEFAULT,
                     val detail: MapDetail = MapDetail.CLEAN, val size: Int = 240)
interface SurroundingMapSource {
    fun capture(fix: PhoneFix, zoom: Float, detail: MapDetail, done: (MapPixels?, String?) -> Unit)
    fun cancel()
}
