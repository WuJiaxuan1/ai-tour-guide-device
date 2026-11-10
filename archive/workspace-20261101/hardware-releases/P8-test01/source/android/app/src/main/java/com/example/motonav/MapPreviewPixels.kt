package com.example.motonav

/** Draw into our own pixel array before creating the immutable ImageView bitmap.
 * Bitmap.createBitmap(colors,...) is immutable and must never be passed to Canvas. */
object MapPreviewPixels {
    fun render(base: MapPixels, fix: PhoneFix?, route: WalkingRoute?=null, palette: RoutePalette=RoutePalette()): IntArray {
        require(base.size in listOf(240,480) && base.pixels.size == base.size * base.size)
        val (left,top)=MapChunkPolicy.origin(base,fix)
        val pixels=IntArray(240*240)
        for(y in 0 until 240) base.pixels.copyInto(pixels,y*240,(top+y)*base.size+left,(top+y)*base.size+left+240)
        fun dot(cx:Double,cy:Double,r:Double,color:Int) {
            if(cx+r<0 || cy+r<0 || cx-r>239 || cy-r>239) return
            for(y in maxOf(0,(cy-r).toInt())..minOf(239,(cy+r).toInt()))
                for(x in maxOf(0,(cx-r).toInt())..minOf(239,(cx+r).toInt()))
                    if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r) pixels[y*240+x]=color or 0xff000000.toInt()
        }
        if(route!=null) {
            val points=route.points.map {RouteGeometry.project(base.bounds,it,base.size)}
            for((color,width) in listOf(palette.outline to (palette.width+4),palette.route to palette.width)) {
                for(i in 1 until points.size) {
                    val a=points[i-1];val b=points[i]
                    val line=RouteGeometry.clip(a.first-left,a.second-top,b.first-left,b.second-top,239.0) ?: continue
                    val steps=kotlin.math.ceil(maxOf(kotlin.math.abs(line[2]-line[0]),kotlin.math.abs(line[3]-line[1]))).toInt().coerceAtLeast(1)
                    for(j in 0..steps) {val t=j.toDouble()/steps;dot(line[0]+(line[2]-line[0])*t,line[1]+(line[3]-line[1])*t,width*240.0/466/2,color)}
                }
            }
            val end=RouteGeometry.project(base.bounds,route.destination,base.size)
            val ex=kotlin.math.round(end.first-left).toInt();val ey=kotlin.math.round(end.second-top).toInt()
            if(ex in 0..239 && ey in 0..239) {
                for(y in maxOf(0,ey-7)..minOf(239,ey+7)) for(x in maxOf(0,ex-7)..minOf(239,ex+7))
                    pixels[y*240+x]=(if(kotlin.math.abs(x-ex)<=5 && kotlin.math.abs(y-ey)<=5) palette.destination else palette.outline) or 0xff000000.toInt()
            }
        }
        val point=fix?.let {base.bounds.pixel(it.lat,it.lng,base.size)} ?: return pixels
        val cx=kotlin.math.round(point.first).toInt()-left
        val cy=kotlin.math.round(point.second).toInt()-top
        for(y in maxOf(0,cy-7)..minOf(239,cy+7)) for(x in maxOf(0,cx-7)..minOf(239,cx+7)) {
            val d=(x-cx)*(x-cx)+(y-cy)*(y-cy)
            if(d<=49) pixels[y*240+x]=(if(d<=25) palette.position else palette.outline) or 0xff000000.toInt()
        }
        return pixels
    }
}

/** SDK draws its logo on the bottom edge; export only the central map viewport.
 * Geographic bounds must be projected from these exact crop corners. */
object MapViewport {
    const val SOURCE=720
    const val SIZE=480
    const val LEFT=120
    const val TOP=120
    const val RIGHT=LEFT+SIZE
    const val BOTTOM=TOP+SIZE
}
