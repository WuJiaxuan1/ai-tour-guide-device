package com.example.motonav

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32
import kotlin.math.*

data class RoutePoint(val lat: Double, val lng: Double) {
    fun valid() = lat.isFinite() && lng.isFinite() && abs(lat)<85 && abs(lng)<=180
}
data class WalkingRoute(val name: String, val destination: RoutePoint, val points: List<RoutePoint>,
                        val meters: Int, val seconds: Long)
data class RoutePalette(val route: Int=0xff4fb4, val position: Int=0x008cff,
                        val destination: Int=0xffb547, val outline: Int=0xffffff,
                        val traveled: Int=0x888888, val width: Int=8) {
    fun valid()=listOf(route,position,destination,outline,traveled).all {it in 0..0xffffff} && width in 2..16
}

/** GCJ-02 geographic route, independent of map frame and map zoom. */
object RouteWire {
    const val HEADER=80
    const val MAX_POINTS=2048
    data class Frame(val bytes: ByteArray,val revision: Int,val session: String,val crc: Long)
    fun encode(route: WalkingRoute?, palette: RoutePalette, revision: Int, session: String, resetProgress:Boolean=false): Frame {
        require(palette.valid() && revision in 1..2_000_000_000 && session.matches(Regex("[0-9a-f]{32}")))
        val points=route?.points.orEmpty()
        require(route==null || (points.size in 2..MAX_POINTS && points.all {it.valid()} && route.destination.valid()))
        val data=ByteArray(HEADER+points.size*16)
        val b=ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        b.put(byteArrayOf(81,82,84,69,1,if(route==null) 0 else 1,1,0))
        b.putInt(revision).putInt(points.size).putInt(data.size).putInt(0)
        for(i in session.indices step 2) b.put(session.substring(i,i+2).toInt(16).toByte())
        listOf(palette.route,palette.position,palette.destination,palette.outline,palette.traveled).forEach {b.putInt(it)}
        b.putShort(palette.width.toShort()).putShort(if(resetProgress) 1 else 0)
        b.putDouble(route?.destination?.lat ?: 0.0).putDouble(route?.destination?.lng ?: 0.0)
        points.forEach {b.putDouble(it.lat).putDouble(it.lng)}
        // Header (including revision/action) and payload are protected; checksum field is zero during CRC.
        val crc=CRC32().apply {update(data)}.value
        b.putInt(20,crc.toInt())
        return Frame(data,revision,session,crc)
    }
    /** Bounded iterative RDP; never silently truncate a route or connect to an invented endpoint. */
    fun simplify(raw: List<RoutePoint>): List<RoutePoint> {
        require(raw.size in 2..100_000 && raw.all {it.valid()}) {"路线坐标无效或过多"}
        val p=raw.filterIndexed {i,v->i==0 || v!=raw[i-1]}
        require(p.size>=2) {"路线没有有效线段"}
        val scale=111_320.0*cos(Math.toRadians(p[0].lat))
        val xy=p.map {((it.lng-p[0].lng)*scale) to ((it.lat-p[0].lat)*111_320.0)}
        for(tolerance in listOf(1.0,2.0,4.0,8.0)) {
            val keep=BooleanArray(p.size);keep[0]=true;keep[p.lastIndex]=true
            val stack=java.util.ArrayDeque<Pair<Int,Int>>();stack.push(0 to p.lastIndex)
            while(stack.isNotEmpty()) {
                val (a,z)=stack.pop();val (ax,ay)=xy[a];val (zx,zy)=xy[z]
                val dx=zx-ax;val dy=zy-ay;val length=dx*dx+dy*dy
                var best=tolerance*tolerance;var at=-1
                for(i in a+1 until z) {
                    val (x,y)=xy[i];val t=if(length==0.0) 0.0 else (((x-ax)*dx+(y-ay)*dy)/length).coerceIn(0.0,1.0)
                    val distance=(x-ax-t*dx).pow(2)+(y-ay-t*dy).pow(2)
                    if(distance>best) {best=distance;at=i}
                }
                if(at>=0) {keep[at]=true;stack.push(a to at);stack.push(at to z)}
            }
            val result=p.filterIndexed {i,_->keep[i]}
            if(result.size<=MAX_POINTS) return result
        }
        error("路线过长或过于复杂，请选择更近的目的地")
    }
}

object RouteGeometry {
    data class Match(val progress:Double,val distanceMeters:Double,val cursor:Double,val meters:Double)
    fun project(bounds: GeoBounds, point: RoutePoint, size: Int): Pair<Double,Double> {
        fun mercator(lat:Double)=ln(tan(PI/4+Math.toRadians(lat)/2))
        return (point.lng-bounds.west)/(bounds.east-bounds.west)*size to
            (mercator(bounds.north)-mercator(point.lat))/(mercator(bounds.north)-mercator(bounds.south))*size
    }
    // Clips crossing segments even when both vertices are outside the viewport.
    fun clip(x0:Double,y0:Double,x1:Double,y1:Double,size:Double): DoubleArray? {
        var lo=0.0;var hi=1.0;val dx=x1-x0;val dy=y1-y0
        val p=doubleArrayOf(-dx,dx,-dy,dy);val q=doubleArrayOf(x0,size-x0,y0,size-y0)
        for(i in 0..3) {
            if(p[i]==0.0) {if(q[i]<0) return null}
            else {val r=q[i]/p[i];if(p[i]<0) lo=max(lo,r) else hi=min(hi,r);if(lo>hi) return null}
        }
        return doubleArrayOf(x0+lo*dx,y0+lo*dy,x0+hi*dx,y0+hi*dy)
    }
    /** Match a real phone fix to the nearest route segment. A distant GPS fix does not recolour the route. */
    fun match(points:List<RoutePoint>, fix:PhoneFix, maxDistanceMeters:Double=40.0,
              minAlong:Double=0.0,maxAlong:Double=Double.POSITIVE_INFINITY,preferAlong:Double=0.0): Match? {
        if(points.size<2 || !fix.lat.isFinite() || !fix.lng.isFinite()) return null
        val lat0=Math.toRadians(points[0].lat);val scale=111320.0;val cosLat=cos(lat0)
        fun xy(p:RoutePoint)=((p.lng-points[0].lng)*scale*cosLat) to ((p.lat-points[0].lat)*scale)
        val target=((fix.lng-points[0].lng)*scale*cosLat) to ((fix.lat-points[0].lat)*scale)
        val xy=points.map(::xy);var total=0.0
        for(i in 1 until xy.size) total+=hypot(xy[i].first-xy[i-1].first,xy[i].second-xy[i-1].second)
        if(total<=0.0) return null
        var walked=0.0;var best=Double.POSITIVE_INFINITY;var bestAlong=0.0;var bestCursor=0.0
        for(i in 1 until xy.size) {
            val dx=xy[i].first-xy[i-1].first;val dy=xy[i].second-xy[i-1].second;val len=hypot(dx,dy)
            if(len==0.0) continue
            val t=(((target.first-xy[i-1].first)*dx+(target.second-xy[i-1].second)*dy)/(len*len)).coerceIn(0.0,1.0)
            val nearX=xy[i-1].first+t*dx;val nearY=xy[i-1].second+t*dy
            val distance=hypot(target.first-nearX,target.second-nearY)
            val along=walked+t*len
            if(along in minAlong..maxAlong && distance<=maxDistanceMeters &&
                (distance<best-3 || (abs(distance-best)<=3 && abs(along-preferAlong)<abs(bestAlong-preferAlong)))) {
                best=distance;bestAlong=along;bestCursor=(i-1)+t
            }
            walked+=len
        }
        return if(best<=maxDistanceMeters) Match((bestAlong/total).coerceIn(0.0,1.0),best,bestCursor,bestAlong) else null
    }
}

/** Monotonic route prefix, not a GPS breadcrumb recorder. The phone is the sole progress authority. */
class RouteProgressTracker {
    private var route:WalkingRoute?=null
    private var handledAt=-1L
    private var acceptedAt=-1L
    var cursor=0.0;private set
    var meters=0.0;private set
    var fraction=0.0;private set
    var state="等待路线与定位";private set
    fun setRoute(value:WalkingRoute?):Boolean {
        if(route===value) return false
        route=value;handledAt=-1;acceptedAt=-1;cursor=0.0;meters=0.0;fraction=0.0
        state=if(value==null) "巡航模式" else "等待沿路线行走"
        return true
    }
    fun update(fix:PhoneFix?,now:Long) {
        val path=route ?: return
        if(fix==null || !fix.usable(now) || fix.accuracy>25) {state="定位不足，保留已走进度";return}
        if(fix.elapsedMs<=handledAt) return
        handledAt=fix.elapsedMs
        val allowance=if(acceptedAt<0) 150.0 else (maxOf(0L,fix.elapsedMs-acceptedAt)/1000.0*3+fix.accuracy*2+15).coerceIn(30.0,150.0)
        val match=RouteGeometry.match(path.points,fix,(fix.accuracy*1.5).coerceIn(12.0,40.0),
            maxOf(0.0,meters-30),meters+allowance,meters)
        if(match==null) {state="偏离路线或位置跳变，保留已走进度";return}
        acceptedAt=fix.elapsedMs
        // GPS jitter and retracing a walked section must never erase or repeatedly inflate progress.
        if(match.meters>=meters+2 || (match.progress>=.999999 && match.meters>meters)) {
            cursor=maxOf(cursor,match.cursor);meters=maxOf(meters,match.meters);fraction=maxOf(fraction,match.progress)
        }
        state="已走约 ${meters.toInt()} m（${(fraction*100).toInt()}%）"
    }
}
