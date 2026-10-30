package com.example.motonav

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.*
import org.junit.Test

class MapChunkTest {
    private val bounds=GeoBounds(32.02,118.78,31.98,118.82)
    private fun block()=MapPixels(IntArray(480*480){it},bounds,14f,MapDetail.CLEAN,480)
    private val fix=PhoneFix(32.0,118.80,8.0,1000)
    @Test fun prefetchStartsBeforeViewportReachesBlockEdge() {
        val b=block()
        assertFalse(MapChunkPolicy.needsRefresh(b,fix))
        val east=fix.copy(lng=118.806)
        assertTrue(MapChunkPolicy.needsRefresh(b,east))
        assertTrue(MapChunkPolicy.covers(b,east))
        assertFalse(MapChunkPolicy.covers(b,fix.copy(lng=118.815)))
        assertTrue(MapChunkPolicy.needsRefresh(b,fix.copy(lng=119.0)))
    }
    @Test fun previewCropsWithoutShrinkingGeographicWindowOrMutatingChunk() {
        val b=block();val p=MapPreviewPixels.render(b,fix)
        assertEquals(240*240,p.size)
        assertEquals(b.pixels[120*480+120],p[0])
        assertEquals(0xff008cff.toInt(),p[120*240+120])
        assertEquals(120*480+120,b.pixels[120*480+120])
        val moved=fix.copy(lng=118.805)
        assertEquals(180,MapChunkPolicy.origin(b,moved).first)
        assertEquals(b.pixels[120*480+180],MapPreviewPixels.render(b,moved)[0])
    }
    @Test fun edgeClampsWindowButDoesNotFakeCenteredLocation() {
        val b=block();val east=fix.copy(lng=118.819)
        assertEquals(240,MapChunkPolicy.origin(b,east).first)
        val image=MapPreviewPixels.render(b,east)
        assertNotEquals(0xff008cff.toInt(),image[120*240+120])
        assertEquals(0xff008cff.toInt(),image[120*240+228])
    }
    @Test fun aheadTargetIsBoundedAndIgnoredForUnreliableDirection() {
        val b=block()
        assertEquals(fix,MapChunkPolicy.target(fix,b))
        val moving=fix.copy(speed=40.0,bearing=90.0)
        val target=MapChunkPolicy.target(moving,b)
        val dx=b.bounds.pixel(target.lat,target.lng,480)!!.first-240
        assertEquals(40.0,dx,0.01)
        assertEquals(moving.copy(accuracy=40.0),MapChunkPolicy.target(moving.copy(accuracy=40.0),b))
        assertEquals(moving.copy(speed=0.0),MapChunkPolicy.target(moving.copy(speed=0.0),b))
    }
    @Test fun exportsChunkToActualCppHandlerAndRejectsUnboundedImages() {
        val b=block();val frame=MapFrameEncoder.encode(b.pixels,25,"0123456789abcdef0123456789abcdef",bounds,480)
        val header=ByteBuffer.wrap(frame.bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(460896,frame.bytes.size)
        assertEquals(3,frame.bytes[4].toInt());assertEquals(3,frame.bytes[5].toInt())
        assertEquals(480,header.getShort(8).toInt());assertEquals(460800,header.getInt(16))
        File(requireNotNull(System.getProperty("mapFrameFixture"))).resolveSibling("phone-chunk-frame.bin").writeBytes(frame.bytes)
        for(size in listOf(0,241,481,960)) {
            try {MapFrameEncoder.encode(IntArray(0),1,"0".repeat(32),bounds,size);fail()} catch(_:IllegalArgumentException) {}
        }
        try {MapFrameEncoder.encode(b.pixels,1,"0".repeat(32),null,480);fail()} catch(_:IllegalArgumentException) {}
    }
}
