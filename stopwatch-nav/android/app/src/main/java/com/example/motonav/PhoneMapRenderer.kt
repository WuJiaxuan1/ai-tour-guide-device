package com.example.motonav

import android.graphics.Bitmap
import android.graphics.Point
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.amap.api.maps.AMap
import com.amap.api.maps.CameraUpdateFactory
import com.amap.api.maps.TextureMapView
import com.amap.api.maps.model.CameraPosition
import com.amap.api.maps.model.LatLng
import kotlin.math.abs

/** Adapted from MotoNav AmapCaptureHost: wait for complete SDK screenshots and
 * validate projection, but omit BLE, routes, building passes and navigation. */
class PhoneMapRenderer(private val view: TextureMapView) : SurroundingMapSource {
    var detail: MapDetail = MapDetail.CLEAN
        set(value) { field=value; applyDetail() }
    private val ui=Handler(Looper.getMainLooper())
    private val map=view.map
    private var loaded=false
    private var serial=0
    private var pending: ((MapPixels?,String?)->Unit)?=null
    private var deadline=0L
    init {
        map.uiSettings.setAllGesturesEnabled(false)
        map.uiSettings.isZoomControlsEnabled=false
        map.uiSettings.isCompassEnabled=false
        map.uiSettings.isScaleControlsEnabled=true
        map.uiSettings.logoPosition=0 // SDK bottom-left logo stays outside the exported center viewport.
        map.isMyLocationEnabled=false
        map.isTrafficEnabled=false
        map.showBuildings(false); map.showIndoorMap(false); applyDetail()
        map.mapType=AMap.MAP_TYPE_NORMAL
        map.setOnMapLoadedListener { loaded=true }
    }
    private fun applyDetail() {
        map.showBuildings(false)
        map.showMapText(detail.showText)
    }
    override fun capture(fix: PhoneFix, zoom: Float, requestedDetail: MapDetail, done: (MapPixels?,String?)->Unit) {
        check(Looper.myLooper()==Looper.getMainLooper())
        cancel()
        pending=done; val id=serial; deadline=SystemClock.elapsedRealtime()+25_000
        detail=requestedDetail; applyDetail()
        val camera=CameraPosition(LatLng(fix.lat,fix.lng),zoom,0f,0f)
        applyDetail()
        map.moveCamera(CameraUpdateFactory.newCameraPosition(camera))
        ui.postDelayed({ request(id,fix,zoom,requestedDetail) },1000)
        ui.postDelayed({ if(id==serial && pending!=null) finish(null,"高德地图加载超时，请检查网络、Key、包名与签名") },25_000)
    }
    private fun request(id: Int, fix: PhoneFix, zoom: Float, requestedDetail: MapDetail) {
        if(id!=serial || pending==null) return
        fun retry() {
            if(SystemClock.elapsedRealtime()<deadline) ui.postDelayed({request(id,fix,zoom,requestedDetail)},1000)
            else finish(null,"高德地图尚未完整加载，请检查 Key 与移动网络")
        }
        if(!loaded || view.width!=MapViewport.SOURCE || view.height!=MapViewport.SOURCE) { retry(); return }
        val camera=map.cameraPosition
        if(abs(camera.target.latitude-fix.lat)>.00003 || abs(camera.target.longitude-fix.lng)>.00003 ||
            abs(camera.tilt)>.1 || minOf(abs(camera.bearing),abs(camera.bearing-360))>.1 || abs(camera.zoom-zoom)>.1) { retry(); return }
        val projection=map.projection
        val nw=projection.fromScreenLocation(Point(MapViewport.LEFT,MapViewport.TOP))
        val se=projection.fromScreenLocation(Point(MapViewport.RIGHT,MapViewport.BOTTOM))
        val bounds=GeoBounds(nw.latitude,nw.longitude,se.latitude,se.longitude)
        if(!bounds.valid()) { finish(null,"地图投影范围无效"); return }
        try {
            map.getMapScreenShot(object: AMap.OnMapScreenShotListener {
                override fun onMapScreenShot(bitmap: Bitmap?) {}
                override fun onMapScreenShot(bitmap: Bitmap?, status: Int) {
                    ui.post {
                        try {
                            if(id!=serial || pending==null) return@post
                            if(status!=1 || bitmap==null) { retry(); return@post }
                            if(bitmap.width!=MapViewport.SOURCE || bitmap.height!=MapViewport.SOURCE) { finish(null,"高德截图尺寸不符"); return@post }
                            val current=map.cameraPosition
                            if(abs(current.target.latitude-camera.target.latitude)>.000001 || abs(current.target.longitude-camera.target.longitude)>.000001 ||
                                abs(current.zoom-camera.zoom)>.001 || abs(current.bearing-camera.bearing)>.001 || abs(current.tilt-camera.tilt)>.001) { retry(); return@post }
                            val pixels=IntArray(MapViewport.SIZE*MapViewport.SIZE)
                            bitmap.getPixels(pixels,0,MapViewport.SIZE,MapViewport.LEFT,MapViewport.TOP,MapViewport.SIZE,MapViewport.SIZE)
                            // Crop image and projection together; do not erase pixels or shift the GPS point.
                            if(pixels.indices.step(7).all { pixels[it]==pixels[0] }) { retry(); return@post }
                            finish(MapPixels(pixels,bounds,zoom,requestedDetail,MapViewport.SIZE),null)
                        } catch(e: Exception) { finish(null,"地图截图失败：${e.javaClass.simpleName}") }
                        // The SDK owns its callback bitmap; let GC release it after we copy the pixels.
                    }
                }
            })
        } catch(e: Exception) { finish(null,"地图截图失败：${e.javaClass.simpleName}") }
    }
    private fun finish(image: MapPixels?, error: String?) {
        val done=pending ?: return
        pending=null; ++serial; ui.removeCallbacksAndMessages(null)
        done(image,error)
    }
    override fun cancel() { ++serial; pending=null; ui.removeCallbacksAndMessages(null) }
}
