package com.example.motonav

/** Draw into our own pixel array before creating the immutable ImageView bitmap.
 * Bitmap.createBitmap(colors,...) is immutable and must never be passed to Canvas. */
object MapPreviewPixels {
    fun render(base: MapPixels, fix: PhoneFix?, route: WalkingRoute?=null, palette: RoutePalette=RoutePalette(), progress:Double=0.0): IntArray {
        val pixels=renderSquare(base,fix,route,palette,progress)
        if(base.overviewRoute!=null) for(y in 0 until 240) for(x in 0 until 240)
            if((x-119.5)*(x-119.5)+(y-119.5)*(y-119.5)>120*120) pixels[y*240+x]=0xff000000.toInt()
        return pixels
    }
    private fun renderSquare(base:MapPixels,fix:PhoneFix?,route:WalkingRoute?,palette:RoutePalette,progress:Double):IntArray {
        require(base.size in listOf(240,480) && base.pixels.size == base.size * base.size)
        if(base.overviewRoute!=null && base.size==480) {
            val reduced=IntArray(240*240) {i->base.pixels[(i/240*2)*480+i%240*2]}
            return renderSquare(base.copy(pixels=reduced,size=240),fix,route?.takeIf {RouteOverview.geometryKey(it)==RouteOverview.geometryKey(base.overviewRoute)},palette,progress)
        }
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
            fun draw(color:Int,width:Int,a:Pair<Double,Double>,b:Pair<Double,Double>) {
                    val line=RouteGeometry.clip(a.first-left,a.second-top,b.first-left,b.second-top,239.0) ?: return
                    val steps=kotlin.math.ceil(maxOf(kotlin.math.abs(line[2]-line[0]),kotlin.math.abs(line[3]-line[1]))).toInt().coerceAtLeast(1)
                    for(j in 0..steps) {val t=j.toDouble()/steps;dot(line[0]+(line[2]-line[0])*t,line[1]+(line[3]-line[1])*t,width*240.0/466/2,color)}
            }
            // Outline all portions first, then paint the travelled and remaining colours on top.
            for(i in 1 until points.size) {
                draw(palette.outline,palette.width+4,points[i-1],points[i])
            }
            for(i in 1 until points.size) {
                    val a=points[i-1];val b=points[i]
                    val cut=progress.takeIf {it>i-1 && it<i}?.let {it-(i-1)}
                    if(cut==null) draw(if(i<=progress) palette.traveled else palette.route,palette.width,a,b)
                    else {val c=(a.first+(b.first-a.first)*cut) to (a.second+(b.second-a.second)*cut);draw(palette.traveled,palette.width,a,c);draw(palette.route,palette.width,c,b)}
            }
            val end=RouteGeometry.project(base.bounds,route.destination,base.size)
            val ex=kotlin.math.round(end.first-left).toInt();val ey=kotlin.math.round(end.second-top).toInt()
            if(base.overviewRoute!=null) {
                val start=points.first()
                dot(start.first,start.second,7.0,palette.outline);dot(start.first,start.second,5.0,0x48da73)
                dot(end.first,end.second,7.0,palette.outline);dot(end.first,end.second,5.0,palette.destination)
            } else if(ex in 0..239 && ey in 0..239) {
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
