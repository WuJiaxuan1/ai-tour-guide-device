package com.example.motonav

import org.junit.Assert.*
import org.junit.Test
import kotlin.math.pow

class MapZoomTest {
    @Test fun invalidSavedValuesAndOutOfRangeInputsRecover() {
        for(value in listOf(Float.NaN,Float.POSITIVE_INFINITY,Float.NEGATIVE_INFINITY))
            assertEquals(MapZoom.DEFAULT,MapZoom.normalize(value),0f)
        assertEquals(13f,MapZoom.normalize(-100f),0f)
        assertEquals(18f,MapZoom.normalize(100f),0f)
        assertEquals(14.5f,MapZoom.normalize(14.62f),0f)
    }
    @Test fun everySliderPositionSurvivesSaveAndRestore() {
        for(progress in 0..MapZoom.STEPS) {
            val saved=MapZoom.fromProgress(progress)
            assertEquals(progress,MapZoom.progress(saved))
            assertEquals(saved,MapZoom.normalize(saved),0f)
        }
        assertEquals(MapZoom.MIN,MapZoom.fromProgress(-1),0f)
        assertEquals(MapZoom.MAX,MapZoom.fromProgress(100),0f)
    }
    @Test fun widestMapFitsProtocolAtStandardMercatorScale() {
        // 240-pixel crop at zoom 13, with conservative 256-pixel world tiles.
        val longitudeSpan=240.0*360/(256*2.0.pow(MapZoom.MIN.toDouble()))
        assertTrue(GeoBounds(longitudeSpan/2,-longitudeSpan/2,-longitudeSpan/2,longitudeSpan/2).valid())
    }
}
