package com.example.motonav

import org.junit.Assert.*
import org.junit.Test

class MapPreviewPixelsTest {
    private val green=0xff00ff00.toInt()
    private fun base()=MapPixels(IntArray(240*240){green},GeoBounds(32.01,118.79,32.0,118.8))
    @Test fun firstMapWithPositionDrawsDotWithoutMutatingBasemap() {
        val map=base()
        val image=MapPreviewPixels.render(map,PhoneFix(32.005,118.795,8.0,0))
        assertEquals(0xff008cff.toInt(),image[120*240+120])
        assertEquals(0xffffffff.toInt(),image[120*240+127])
        assertTrue(map.pixels.all{it==green})
        assertArrayEquals(map.pixels,MapPreviewPixels.render(map,null))
    }
    @Test fun repeatedMovingPointsDoNotAccumulateOrWriteOutsideBitmap() {
        val map=base()
        for(i in 0..500) {
            val lng=118.79+(i%241)/240.0*.01
            val p=MapPreviewPixels.render(map,PhoneFix(32.005,lng,8.0,0))
            assertTrue(p.count{it!=green}<=149)
            assertTrue(map.pixels.all{it==green})
        }
        assertArrayEquals(map.pixels,MapPreviewPixels.render(map,PhoneFix(33.0,119.0,8.0,0)))
    }
    @Test fun centerCropAndProjectedBoundsHaveIdenticalCenter() {
        assertEquals(480,MapViewport.RIGHT-MapViewport.LEFT)
        assertEquals(480,MapViewport.BOTTOM-MapViewport.TOP)
        assertEquals(MapViewport.SOURCE/2,(MapViewport.LEFT+MapViewport.RIGHT)/2)
        assertEquals(MapViewport.SOURCE/2,(MapViewport.TOP+MapViewport.BOTTOM)/2)
        assertTrue(MapViewport.SOURCE-MapViewport.BOTTOM>=120)
    }
}
