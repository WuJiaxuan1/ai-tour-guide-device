package com.example.motonav

import android.content.Context
import com.amap.api.services.core.LatLonPoint
import com.amap.api.services.core.ServiceSettings
import com.amap.api.services.help.Inputtips
import com.amap.api.services.help.InputtipsQuery
import com.amap.api.services.route.RouteSearchV2

/** Search SDK only: no navigation engine, BLE service, voice or simulated GPS. Worker-thread calls. */
class WalkingRoutePlanner(private val context: Context) {
    data class Place(val name:String,val address:String,val point:RoutePoint)
    private fun prepare() {
        ServiceSettings.updatePrivacyShow(context,true,true)
        ServiceSettings.updatePrivacyAgree(context,true)
        ServiceSettings.getInstance().apply {
            setApiKey(Keys.amap(context));setProtocol(ServiceSettings.HTTPS)
            setConnectionTimeOut(10000);setSoTimeOut(15000)
        }
    }
    fun search(query:String,city:String): List<Place> {
        prepare()
        return Inputtips(context,InputtipsQuery(query,city)).requestInputtips().orEmpty().mapNotNull {tip->
            tip.point?.let {point->
                RoutePoint(point.latitude,point.longitude).takeIf {it.valid()}?.let {
                    Place(tip.name.orEmpty(),tip.district.orEmpty()+" "+tip.address.orEmpty(),it)
                }
            }
        }.take(12)
    }
    fun plan(from:PhoneFix,to:Place): WalkingRoute {
        prepare()
        val request=RouteSearchV2.WalkRouteQuery(RouteSearchV2.FromAndTo(
            LatLonPoint(from.lat,from.lng),LatLonPoint(to.point.lat,to.point.lng))).apply {
            setShowFields(RouteSearchV2.ShowFields.POLINE or RouteSearchV2.ShowFields.COST)
        }
        val path=RouteSearchV2(context).calculateWalkRoute(request)?.paths?.firstOrNull()
            ?: error("高德未返回可用步行路线，请换一个目的地")
        val steps=path.steps.orEmpty()
        require(steps.isNotEmpty() && steps.all {!it.polyline.isNullOrEmpty()}) {"高德返回的路线缺少完整折线，不能显示，请重试"}
        val raw=steps.flatMap {it.polyline}.map {RoutePoint(it.latitude,it.longitude)}
        return WalkingRoute(to.name,to.point,RouteWire.simplify(raw),path.distance.toInt(),path.duration)
    }
}
