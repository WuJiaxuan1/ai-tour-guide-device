package com.example.motonav

/** Draw into our own pixel array before creating the immutable ImageView bitmap.
 * Bitmap.createBitmap(colors,...) is immutable and must never be passed to Canvas. */
object MapPreviewPixels {
    fun render(base: MapPixels, fix: PhoneFix?): IntArray {
        require(base.pixels.size == 240 * 240)
        val pixels=base.pixels.clone()
        val point=fix?.let {base.bounds.pixel(it.lat,it.lng)} ?: return pixels
        val cx=kotlin.math.round(point.first).toInt()
        val cy=kotlin.math.round(point.second).toInt()
        for(y in maxOf(0,cy-7)..minOf(239,cy+7)) for(x in maxOf(0,cx-7)..minOf(239,cx+7)) {
            val d=(x-cx)*(x-cx)+(y-cy)*(y-cy)
            if(d<=49) pixels[y*240+x]=if(d<=25) 0xff008cff.toInt() else 0xffffffff.toInt()
        }
        return pixels
    }
}

/** SDK draws its logo on the bottom edge; export only the central map viewport.
 * Geographic bounds must be projected from these exact crop corners. */
object MapViewport {
    const val SOURCE=480
    const val SIZE=240
    const val LEFT=120
    const val TOP=120
    const val RIGHT=LEFT+SIZE
    const val BOTTOM=TOP+SIZE
}
