package com.example.motonav

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.*
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.WindowManager
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.amap.api.maps.MapsInitializer
import com.amap.api.maps.TextureMapView
import java.util.UUID
import java.util.concurrent.Executors
import java.util.Locale

/** P7 deliberately runs in the foreground. No BLE/navigation/music services. */
class SurroundingMapActivity : AppCompatActivity(), LocationListener {
    private val ui=Handler(Looper.getMainLooper())
    private val worker=Executors.newSingleThreadExecutor()
    private lateinit var address: EditText
    private lateinit var state: TextView
    private lateinit var gps: TextView
    private lateinit var detail: TextView
    private lateinit var keyState: TextView
    private lateinit var zoomState: TextView
    private lateinit var zoomSlider: SeekBar
    private var selectedZoom=MapZoom.DEFAULT
    private var draggingZoom=false
    private var mapDetail=MapDetail.CLEAN
    private lateinit var detailState: TextView
    private var savingKey=false
    private lateinit var preview: ImageView
    private lateinit var mapHost: FrameLayout
    private lateinit var location: LocationManager
    private var mapView: TextureMapView?=null
    private var source: SurroundingMapSource?=null
    private var running=false
    private var foreground=false
    private var epoch=0
    private var captureEpoch=0
    private var busy=false
    private var capturing=false
    private var mapActive=false
    private var client: LocalLinkClient?=null
    private var session=""
    private var boot=""
    private var nextFrame=1
    private var nextPosition=1
    private var installedId=0
    private var cached: MapPixels?=null
    private var ready: MapPixels?=null
    private var fix: PhoneFix?=null
    private var lastCapture=0L
    private var forceMap=true
    private var mapsSent=0
    private var positionsSent=0
    private var previewBitmap: Bitmap?=null
    private lateinit var routeControls:WalkingRouteControls
    private var routeRevision=1
    private var uploadedRouteRevision=0
    private val routeProgress=RouteProgressTracker()
    private var routeGeneration=0
    private var resetGenerationConfirmed=-1
    private lateinit var progressState:TextView
    private val tick=object: Runnable {
        override fun run() {
            if(!running) return
            showFix()
            if(!busy) poll()
            ui.postDelayed(this,1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        location=getSystemService(LOCATION_SERVICE) as LocationManager
        val mapPrefs=getSharedPreferences("p7_map",MODE_PRIVATE)
        selectedZoom=MapZoom.normalize(mapPrefs.getFloat("map_zoom",MapZoom.DEFAULT))
        mapDetail=MapDetail.restore(mapPrefs.getString("map_detail",MapDetail.CLEAN.name))
        val padding=dp(16)
        val content=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(padding,padding,padding,padding) }
        fun text(value: String,size: Float=15f)=TextView(this).apply {
            text=value; textSize=size; setTextColor(Color.WHITE); setPadding(0,dp(6),0,dp(6))
        }.also { content.addView(it) }
        fun button(label:String,action:()->Unit)=Button(this).apply { text=label; setOnClickListener {action()} }.also {content.addView(it)}
        text("枫叶精灵 · 周边地图",24f)
        text("P8-test02｜已走路线实时变色\n需要 P8-test02 手表固件。保持本页在前台，手表切到地图页。")
        address=EditText(this).apply {
            hint="手表 IP"; inputType=InputType.TYPE_CLASS_PHONE; setSingleLine(true)
            setText(getSharedPreferences("local_link",MODE_PRIVATE).getString("ip",""))
        }; content.addView(address)
        button("高德 Key 设置 / 复制包名与 SHA1") { keyDialog() }
        keyState=text(if(Keys.hasAmap(this)) "高德 Key：${Keys.mask(Keys.userAmap(this))}（手机已保存）" else "高德 Key：未保存")
        button("开始定位和地图同步") { begin() }
        button("停止同步") { stop("已停止；手表最迟 15 秒后隐藏旧定位点") }
        button("重新获取周边底图") { forceMap=true; lastCapture=0; detail.text="已请求刷新；请保持手表在地图页" }
        button("打开手机定位设置") { startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }
        state=text("尚未开始")
        gps=text("GPS：等待开始。首次定位请到室外开阔处。")
        detail=text("地图仅在需要时更新，位置数据约每秒同步一次。")
        text("地图范围：数值越小，看到的范围越大。松开滑条自动更新；选择会保留。",16f)
        zoomState=text("")
        zoomSlider=SeekBar(this).apply {
            max=MapZoom.STEPS; progress=MapZoom.progress(selectedZoom)
            contentDescription="地图缩放级别，左侧范围更大，右侧范围更小"
            setOnSeekBarChangeListener(object: SeekBar.OnSeekBarChangeListener {
                override fun onStartTrackingTouch(bar: SeekBar) {draggingZoom=true}
                override fun onProgressChanged(bar: SeekBar, progress: Int, fromUser: Boolean) {
                    if(fromUser && !draggingZoom) selectZoom(MapZoom.fromProgress(progress))
                    showZoom()
                }
                override fun onStopTrackingTouch(bar: SeekBar) {
                    draggingZoom=false;selectZoom(MapZoom.fromProgress(bar.progress));showZoom()
                }
            })
        }
        content.addView(zoomSlider)
        val zoomButtons=LinearLayout(this)
        fun zoomButton(label:String,action:()->Unit) {
            zoomButtons.addView(Button(this).apply {text=label;setOnClickListener {action()}},LinearLayout.LayoutParams(0,-2,1f))
        }
        zoomButton("－ 看更远") {selectZoom(selectedZoom-.5f)}
        zoomButton("＋ 看更近") {selectZoom(selectedZoom+.5f)}
        content.addView(zoomButtons)
        button("恢复推荐范围（14.0）") {selectZoom(MapZoom.DEFAULT)}
        showZoom()
        text("地图文字：高德没有单独缩字参数；可比较标准地图和隐藏地图标注。",15f)
        detailState=text("")
        val detailButtons=LinearLayout(this)
        MapDetail.entries.forEach { option ->
            detailButtons.addView(Button(this).apply {
                text=option.title
                setOnClickListener { selectDetail(option) }
            },LinearLayout.LayoutParams(0,-2,1f))
        }
        content.addView(detailButtons)
        showDetail()
        routeControls=WalkingRouteControls(this,content,
            currentFix={fix?.takeIf {running && it.usable(now())}},enabled={running && foreground}) {route,_->
            if(routeProgress.setRoute(route)) ++routeGeneration
            routeProgress.update(fix,now())
            ++routeRevision;renderPreview()
            detail.text="路线/配色已修改；同步且地图就绪时自动发送"
        }
        progressState=text("已走进度：等待路线与定位")
        text("手机正在准备的地图块（可提前移向前方）；下方为当前手表窗口")
        mapHost=FrameLayout(this)
        content.addView(mapHost,LinearLayout.LayoutParams(-1,dp(240)))
        text("手表窗口预览：底图已确认；路线和配色预览当前选择，设备是否收到请看同步状态。圆点为定位，方块为终点。")
        preview=ImageView(this).apply { adjustViewBounds=true; contentDescription="已确认地图与手机当前有效位置预览" }
        content.addView(preview,LinearLayout.LayoutParams(-1,dp(240)))
        button("P6 测试图 / 链路诊断") { startActivity(Intent(this,LocalLinkActivity::class.java)) }
        button("查看上次闪退记录") {
            val message=CrashLog.last().ifBlank {"没有记录到 Java 闪退；系统终止或原生崩溃可能不在此记录内"}
            val record=TextView(this).apply {text=message;setTextIsSelectable(true);setPadding(dp(16),dp(12),dp(16),dp(12))}
            AlertDialog.Builder(this).setTitle("上次闪退记录").setView(ScrollView(this).apply{addView(record)})
                .setPositiveButton("关闭",null).setNeutralButton("清除记录") {_,_->CrashLog.clear()}.show()
        }
        text("已走路线根据有效 GPS 逐步变色；低精度、偏离路线或跳变时暂停推进。尚无转向、到达或偏航重算。切换应用或锁屏后停止同步，返回后点“开始”继续。",13f)
        setContentView(ScrollView(this).apply { addView(content) })
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content) { view,insets ->
            val bars=insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() or androidx.core.view.WindowInsetsCompat.Type.ime())
            view.setPadding(padding+bars.left,padding+bars.top,padding+bars.right,padding+bars.bottom); insets
        }
    }
    private fun dp(n:Int)=(n*resources.displayMetrics.density).toInt()
    private fun now()=SystemClock.elapsedRealtime()
    private fun showZoom() {
        if(!::zoomSlider.isInitialized) return
        val value=if(draggingZoom) MapZoom.fromProgress(zoomSlider.progress) else selectedZoom
        val confirmed=cached?.takeIf {running && mapActive && installedId!=0}?.zoom
        val hint=when {
            draggingZoom->"松手后应用"
            !running->"点击开始后应用"
            !mapActive->"等待手表地图页连接"
            confirmed==selectedZoom->"手表已应用"
            confirmed!=null->"手表仍为 $confirmed，等待新图"
            else->"等待有效定位和新图"
        }
        zoomState.text=String.format(Locale.US,"缩放 %.1f（13.0 最远 ↔ 18.0 最近）\n%s",value,hint)
    }
    private fun selectZoom(value:Float) {
        val next=MapZoom.normalize(value)
        if(next!=selectedZoom) {
            selectedZoom=next
            getSharedPreferences("p7_map",MODE_PRIVATE).edit().putFloat("map_zoom",next).apply()
            // Invalidate pending screenshots, but let an in-flight upload finish normally.
            // Its own zoom is retained so it cannot be mistaken for the newly selected map.
            ++captureEpoch;source?.cancel();capturing=false;ready=null
            forceMap=true;lastCapture=0
            detail.text="范围已调整；联网、定位有效且手表在地图页时自动换图"
        }
        zoomSlider.progress=MapZoom.progress(selectedZoom)
        showZoom()
    }
    private fun showDetail() {
        if(!::detailState.isInitialized) return
        val applied=cached?.takeIf {running && mapActive && installedId!=0}?.detail
        val status=when {
            !running->"点击开始后应用"
            !mapActive->"等待手表地图页连接"
            applied==mapDetail->"手表已应用"
            applied!=null->"手表当前为${applied.title}，等待更新"
            else->"等待新图"
        }
        detailState.text="当前档位：${mapDetail.title}（$status）"
        showZoom()
    }
    private fun selectDetail(value: MapDetail) {
        if(value==mapDetail) return
        mapDetail=value
        getSharedPreferences("p7_map",MODE_PRIVATE).edit().putString("map_detail",value.name).apply()
        (source as? PhoneMapRenderer)?.detail=value
        ++captureEpoch;source?.cancel();capturing=false;ready=null
        forceMap=true;lastCapture=0
        detail.text="地图文字档位已调整，正在准备新图"
        renderPreview()
        showDetail()
    }
    private fun keyDialog() {
        if(savingKey) return
        if(running) stop("设置 Key 前已停止同步")
        val box=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(20),dp(10),dp(20),0) }
        val identity="包名：$packageName\n调试版安全码 SHA1：\n${Keys.signSha1(this)}"
        box.addView(TextView(this).apply {text="申请高德 Android 平台 Key，使用下面的包名及安全码。不是 Web 服务 Key。\n$identity"; setTextIsSelectable(true)})
        box.addView(Button(this).apply {text="复制包名和 SHA1"; setOnClickListener {
            (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("高德 Android 配置",identity))
        }})
        val key=EditText(this).apply {hint="粘贴高德 Android Key"; inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; setSingleLine(true); setText(Keys.userAmap(this@SurroundingMapActivity))}
        box.addView(key)
        val dialog=AlertDialog.Builder(this).setTitle("高德地图设置").setView(box).setNegativeButton("取消",null)
            .setPositiveButton("保存并应用",null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val input=key.text.toString()
                if(input.trim().isEmpty() || input.trim().any { it.isWhitespace() }) {
                    key.error="请输入完整的高德 Android Key，不要包含空格或换行";return@setOnClickListener
                }
                savingKey=true
                dialog.setCancelable(false)
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled=false
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE).isEnabled=false
                keyState.text="正在保存 Key…"
                // A separate lifecycle-safe completion: saving continues even while sync is stopped.
                worker.execute {
                    val failure=try {Keys.save(applicationContext,input);null} catch(e:Exception) {e}
                    ui.post {
                        savingKey=false
                        if(isDestroyed || isFinishing) return@post
                        dialog.setCancelable(true)
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).isEnabled=true
                        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).isEnabled=true
                        if(failure!=null) {key.error=failure.message;keyState.text="Key 未确认保存，请重试";return@post}
                        dialog.dismiss()
                        // The old renderer may retain the old key. Dispose it before applying the new key.
                        source?.cancel();source=null
                        mapView?.onPause();mapView?.onDestroy();mapView=null;mapHost.removeAllViews()
                        cached=null;ready=null;installedId=0
                        preview.setImageDrawable(null);previewBitmap=null
                        try {
                            Keys.applyMap(this)
                            keyState.text="高德 Key：${Keys.mask(Keys.userAmap(this))}，已保存并提交给地图 SDK"
                            state.text="Key 已保存并应用，点击“开始定位和地图同步”继续"
                        } catch(e:Exception) {
                            keyState.text="Key 已保存，地图 SDK 应用失败：${e.javaClass.simpleName}"
                            state.text="Key 已保存在手机，请重新打开 App 后重试"
                        }
                    }
                }
            }
        }
        dialog.show()
    }
    private fun begin() {
        if(!foreground) return
        if(savingKey) {state.text="Key 正在保存，请稍候";return}
        if(!Keys.hasAmap(this)) { keyDialog(); return }
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),71); return
        }
        if(!location.isProviderEnabled(LocationManager.GPS_PROVIDER)) {state.text="请先开启手机定位，再点击开始"; return}
        val prefs=getSharedPreferences("p7_map",MODE_PRIVATE)
        if(!prefs.getBoolean("amap_consent",false)) {
            AlertDialog.Builder(this).setTitle("启用高德地图")
                .setMessage("地图功能将使用高德 SDK 加载当前位置附近地图；高德会按其隐私政策处理设备和网络信息。GPS 来自手机，本 App 还会把位置发送给你连接的手表。")
                .setNeutralButton("查看高德隐私政策") {_,_->startActivity(Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://lbs.amap.com/pages/privacy/")))}
                .setNegativeButton("暂不启用",null).setPositiveButton("同意并开始") {_,_->prefs.edit().putBoolean("amap_consent",true).apply();begin()}.show(); return
        }
        val endpoint=try {LocalLinkClient.address(address.text.toString())} catch(e:IllegalArgumentException){state.text=e.message;return}
        stop("正在启动…")
        try {
            if(mapView==null) {
                MapsInitializer.updatePrivacyShow(this,true,true); MapsInitializer.updatePrivacyAgree(this,true)
                Keys.applyMap(this)
                mapView=TextureMapView(this).also { view ->
                    view.onCreate(null)
                    mapHost.addView(view,FrameLayout.LayoutParams(MapViewport.SOURCE,MapViewport.SOURCE,Gravity.CENTER))
                    view.scaleX=dp(240).toFloat()/MapViewport.SOURCE; view.scaleY=view.scaleX
                    source=PhoneMapRenderer(view).also { it.detail=mapDetail }; view.onResume()
                }
            }
            getSharedPreferences("local_link",MODE_PRIVATE).edit().putString("ip",address.text.toString().trim()).apply()
            client=LocalLinkClient(endpoint); session=UUID.randomUUID().toString().replace("-","")
            nextFrame=1;nextPosition=1;installedId=0;uploadedRouteRevision=0;boot="";mapsSent=0;positionsSent=0;cached=null;ready=null;fix=null
            forceMap=true;lastCapture=0;running=true
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            location.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper())
            state.text="正在连接手表；GPS 首次定位可能需要几十秒，请到室外等待"
            ui.post(tick)
        } catch(e:Exception) {stop("启动失败：${e.javaClass.simpleName}，检查定位权限和高德配置")}
    }
    override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,grantResults:IntArray) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if(requestCode==71) {
            if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED) begin()
            else state.text="需要“使用期间允许＋精确位置”；本版不要求后台定位权限"
        }
    }
    override fun onLocationChanged(value: Location) {
        if(!running) return
        @Suppress("DEPRECATION")
        if(value.isFromMockProvider) {fix=null;gps.text="检测到模拟位置，本轮需要真实 GPS";return}
        if(!value.hasAccuracy()) {fix=null;return}
        val gcj=MapGeo.wgsToGcj(value.latitude,value.longitude)
        fix=PhoneFix(gcj[0],gcj[1],value.accuracy.toDouble(),value.elapsedRealtimeNanos/1_000_000,
            if(value.hasSpeed()) value.speed.toDouble() else 0.0, if(value.hasBearing()) value.bearing.toDouble() else null)
        showFix()
    }
    override fun onProviderDisabled(provider:String) {fix=null;showFix()}
    override fun onProviderEnabled(provider:String) {}
    @Deprecated("Android legacy callback") override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?) {}
    private fun showFix() {
        routeProgress.update(fix,now())
        if(::progressState.isInitialized) progressState.text="已走进度：${routeProgress.state}"
        showZoom()
        showDetail()
        val current=fix
        gps.text=when {
            !location.isProviderEnabled(LocationManager.GPS_PROVIDER)->"GPS 已关闭；定位点将隐藏"
            current==null->"GPS：等待真实定位，请到室外开阔处"
            !current.usable(now())->"GPS 暂不可用：精度 ±${current.accuracy.toInt()}m，位置已过去 ${current.age(now())/1000}s"
            else->String.format(Locale.US,"GPS ±%.0fm · %ds 前\n高德坐标 %.6f, %.6f",current.accuracy,current.age(now())/1000,current.lat,current.lng)
        }
        renderPreview()
    }
    private fun publish(token:Int,action:()->Unit) {ui.post {if(running && token==epoch && !isDestroyed) action()}}
    private fun poll() {
        val local=client ?: return; val token=epoch; busy=true
        worker.execute {
            try {
                val status=local.status()
                publish(token) {
                    busy=false
                    if(boot.isNotEmpty() && boot!=status.bootId) {installedId=0;uploadedRouteRevision=0;ready=null}
                    boot=status.bootId
                    if(status.geoProtocol!=1 || status.chunkProtocol!=1 || status.routeProtocol!=1 || status.progressProtocol!=1) {state.text="请先更新 P8-test02 已走路线固件；当前 ${status.firmware}";return@publish}
                    if(status.routeSession!=session || status.routeRevision!=uploadedRouteRevision.toLong()) uploadedRouteRevision=0
                    if(!status.mapActive) {
                        if(mapActive || capturing) {++captureEpoch;source?.cancel();capturing=false;ready=null}
                        mapActive=false;state.text="手表在语音页，已暂停地图和位置发送";return@publish
                    }
                    mapActive=true
                    if(installedId!=0 && (status.imageSession!=session || status.displayedImage!=installedId.toLong())) installedId=0
                    state.text="已连接 ${status.firmware} · 地图页\n地图块 $mapsSent 个 · 位置 $positionsSent 次\n路线/配色：${if(uploadedRouteRevision==routeRevision) "手表已接收" else "等待同步"}"
                    nextAction(local,token)
                }
            } catch(e:Exception) {publish(token) {
                busy=false;mapActive=false;installedId=0;++captureEpoch;source?.cancel();capturing=false;ready=null
                state.text="手表暂时无法连接，自动重试。IP 改变时请修改后重新开始。\n${e.message?.take(100)}"
            }}
        }
    }
    private fun nextAction(local:LocalLinkClient,token:Int) {
        val current=fix?.takeIf {it.usable(now())}
        val base=cached
        if(current!=null && !capturing && ready==null && (forceMap || base==null || base.zoom!=selectedZoom || base.detail!=mapDetail || MapChunkPolicy.needsRefresh(base,current)) && now()-lastCapture>=5000) {
            capturing=true;lastCapture=now();val captureToken=++captureEpoch
            detail.text="正在预取 480×480 地图块；旧地图继续显示…"
            source?.capture(MapChunkPolicy.target(current,base),selectedZoom,mapDetail) {image,error ->
                if(running && epoch==token && captureEpoch==captureToken && mapActive) {
                    capturing=false
                    if(image!=null) {ready=image;forceMap=false;detail.text="底图就绪，等待发送"}
                    else detail.text=error ?: "地图暂不可用，稍后重试"
                }
            }
        }
        val upload=ready ?: base?.takeIf {installedId==0 && it.zoom==selectedZoom && it.detail==mapDetail && current!=null && MapChunkPolicy.covers(it,current) && !forceMap}
        if(installedId!=0 && uploadedRouteRevision!=routeRevision) {sendRoute(local,token);return}
        if(upload!=null && current!=null && MapChunkPolicy.covers(upload,current)) {
            ready=null;sendMap(local,token,upload);return
        }
        if(ready!=null && current!=null && !MapChunkPolicy.covers(ready!!,current)) {ready=null;forceMap=true}
        if(installedId!=0) sendPosition(local,token,current)
    }
    private fun sendMap(local:LocalLinkClient,token:Int,image:MapPixels) {
        busy=true;val id=nextFrame++;val localSession=session;val expectedBoot=boot
        detail.text="发送底图 #$id，完整显示后再更新定位点"
        worker.execute {
            try {
                val frame=MapFrameEncoder.encode(image.pixels,id,localSession,image.bounds,image.size)
                val ack=local.uploadImage(frame)
                check(ack.bootId==expectedBoot) {"手表已重启"}
                var shown=false
                for(i in 0 until 12) {
                    val status=local.status()
                    check(status.bootId==expectedBoot && status.mapActive) {"手表重启或已切到语音页"}
                    if(status.imageSession==localSession && status.displayedImage==id.toLong()) {shown=true;break}
                    Thread.sleep(300)
                }
                check(shown) {"底图显示未确认"}
                publish(token) {
                    busy=false;cached=image;installedId=id;mapsSent++
                    if(image.zoom!=selectedZoom || image.detail!=mapDetail) forceMap=true
                    showZoom()
                    detail.text="底图 #$id 已装载（接收 ${ack.elapsedMs}ms），正在发送当前位置"
                    renderPreview()
                    showDetail()
                    if(uploadedRouteRevision!=routeRevision) sendRoute(local,token)
                    else sendPosition(local,token,fix?.takeIf {it.usable(now())})
                }
            } catch(e:Exception) {publish(token) {busy=false;installedId=0;detail.text="底图未确认：${e.message?.take(100)}；保留完整旧图，稍后重试"}}
        }
    }
    private fun sendPosition(local:LocalLinkClient,token:Int,current:PhoneFix?) {
        busy=true;val id=installedId;val sequence=nextPosition++;val localSession=session;val expectedBoot=boot
        val progressRevision=if(routeControls.route!=null && uploadedRouteRevision==routeRevision) routeRevision else 0
        val cursor=routeProgress.cursor
        worker.execute {
            try {
                val responseBoot=local.position(localSession,id,sequence,current,now(),progressRevision,cursor)
                check(responseBoot==expectedBoot) {"手表已重启"}
                publish(token) {busy=false;positionsSent++}
            } catch(e:Exception) {publish(token) {busy=false;installedId=0;detail.text="位置未确认，下一次检查后恢复：${e.message?.take(100)}"}}
        }
    }
    private fun sendRoute(local:LocalLinkClient,token:Int) {
        busy=true
        val revision=routeRevision;val route=routeControls.route;val palette=routeControls.palette
        val generation=routeGeneration;val reset=route!=null && generation!=resetGenerationConfirmed
        val localSession=session;val expectedBoot=boot
        worker.execute {
            try {
                val response=local.uploadRoute(RouteWire.encode(route,palette,revision,localSession,reset))
                check(response==expectedBoot) {"手表已重启"}
                publish(token) {
                    busy=false;uploadedRouteRevision=revision
                    if(generation==routeGeneration) resetGenerationConfirmed=generation
                    detail.text=if(revision==routeRevision) "手表已接收路线/配色 #$revision；底图无需重传" else "上一版配色已接收，继续同步最新选择"
                    sendPosition(local,token,fix?.takeIf {it.usable(now())})
                }
            } catch(e:Exception) {publish(token) {busy=false;uploadedRouteRevision=0;detail.text="路线未确认，保留原图层并重试：${e.message?.take(100)}"}}
        }
    }
    private fun renderPreview() {
        val base=cached ?: return
        val current=fix?.takeIf {running && mapActive && installedId!=0 && it.usable(now())}
        val pixels=MapPreviewPixels.render(base,current,routeControls.route,routeControls.palette,routeProgress.cursor)
        val bitmap=Bitmap.createBitmap(pixels,240,240,Bitmap.Config.ARGB_8888)
        // Never recycle a bitmap that ImageView/RenderThread may still reference.
        previewBitmap=bitmap;preview.setImageBitmap(bitmap)
    }
    private fun stop(message:String) {
        if(::routeControls.isInitialized) routeControls.cancelPending()
        running=false;++epoch;++captureEpoch;ui.removeCallbacks(tick)
        source?.cancel();capturing=false;busy=false;mapActive=false;ready=null
        client?.cancel();client=null
        runCatching {location.removeUpdates(this)}
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if(::state.isInitialized) {state.text=message;renderPreview();showZoom()}
    }
    override fun onResume() {super.onResume();foreground=true;mapView?.onResume()}
    override fun onPause() {
        foreground=false;stop("已暂停；回到本页后点击开始。手表最迟 15 秒后隐藏旧定位点。")
        mapView?.onPause();super.onPause()
    }
    override fun onDestroy() {stop("已关闭");routeControls.close();worker.shutdownNow();source?.cancel();mapView?.onDestroy();preview.setImageDrawable(null);previewBitmap=null;super.onDestroy()}
}
