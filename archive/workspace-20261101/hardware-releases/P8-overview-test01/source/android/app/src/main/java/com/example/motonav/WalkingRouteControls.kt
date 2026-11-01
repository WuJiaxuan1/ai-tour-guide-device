package com.example.motonav

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.amap.api.services.core.AMapException
import java.util.Locale
import java.util.concurrent.Executors

/** Destination/colour controls share the foreground screen, so choosing does not interrupt map sync. */
class WalkingRouteControls(private val activity:AppCompatActivity, parent:LinearLayout,
    private val currentFix:()->PhoneFix?, private val enabled:()->Boolean,
    private val changed:(WalkingRoute?,RoutePalette)->Unit) {
    private val prefs=activity.getSharedPreferences("p8_route",Context.MODE_PRIVATE)
    private val ui=Handler(Looper.getMainLooper())
    private val worker=Executors.newSingleThreadExecutor()
    private var serial=0
    private var pending=false
    var route:WalkingRoute?=null;private set
    var palette=RoutePalette(prefs.getInt("route",0xff4fb4),prefs.getInt("position",0x008cff),
        prefs.getInt("destination",0xffb547),prefs.getInt("outline",0xffffff),prefs.getInt("traveled",0x888888),
        prefs.getInt("width",8)).takeIf {it.valid()} ?: RoutePalette();private set
    private val state=TextView(activity)
    private val colors=TextView(activity)
    private val sample=object:View(activity) {
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        override fun onDraw(canvas:Canvas) {
            val y=height*.5f;val start=width*.1f;val middle=width*.45f;val end=width*.9f
            paint.strokeCap=Paint.Cap.ROUND
            paint.color=opaque(palette.outline);paint.strokeWidth=palette.width+4f
            canvas.drawLine(start,y,end,y,paint)
            paint.strokeWidth=palette.width.toFloat();paint.color=opaque(palette.traveled);canvas.drawLine(start,y,middle,y,paint)
            paint.color=opaque(palette.route);canvas.drawLine(middle,y,end,y,paint)
            paint.color=opaque(palette.outline);canvas.drawCircle(middle,y,12f,paint);canvas.drawRect(end-13,y-13,end+13,y+13,paint)
            paint.color=opaque(palette.position);canvas.drawCircle(middle,y,9f,paint)
            paint.color=opaque(palette.destination);canvas.drawRect(end-10,y-10,end+10,y+10,paint)
        }
    }
    init {
        fun text(s:String)=TextView(activity).apply {text=s;textSize=15f;setPadding(0,10,0,10)}.also {parent.addView(it)}
        fun button(s:String,f:()->Unit)=Button(activity).apply {text=s;setOnClickListener {f()}}.also {parent.addView(it)}
        text("步行路线 · 独立图层")
        button("搜索目的地并规划步行路线") {searchDialog()}
        button("按高德坐标选择目的地") {coordinateDialog()}
        button("取消路线 / 返回巡航") {cancelPending();route=null;state.text="已取消路线；同步时会清除手表路线和终点";changed(null,palette)}
        state.text="尚未选择目的地";parent.addView(state)
        text("路线配色：修改后保存；同步中自动发送到手表，无需重传底图。")
        parent.addView(colors)
        for((id,label) in listOf("route" to "未走路线", "position" to "当前位置点", "destination" to "目的地", "outline" to "描边", "traveled" to "已走路线"))
            button("调整 $label 颜色") {colorDialog(id,label)}
        val width=SeekBar(activity).apply {
            max=14;progress=palette.width-2
            setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener {
                override fun onStartTrackingTouch(bar:SeekBar) {}
                override fun onProgressChanged(bar:SeekBar,p:Int,user:Boolean) {if(user) {palette=palette.copy(width=p+2);showColors()}}
                override fun onStopTrackingTouch(bar:SeekBar) {saveColors()}
            })
        }
        text("路线粗细（手表像素，2～16）");parent.addView(width)
        button("恢复推荐配色与粗细") {palette=RoutePalette();width.progress=palette.width-2;saveColors()}
        text("配色样例：左段为已走颜色，圆点为当前位置，方块为终点。实际地图会根据定位逐渐变色；建议已走和未走使用明显不同的颜色。")
        sample.setBackgroundColor(0xff20362d.toInt())
        parent.addView(sample,LinearLayout.LayoutParams(-1,(60*activity.resources.displayMetrics.density).toInt()))
        showColors()
    }
    private fun opaque(color:Int)=color or 0xff000000.toInt()
    private fun showColors() {
        colors.text=String.format(Locale.US,"路线 #%06X · 定位 #%06X · 终点 #%06X\n描边 #%06X · 已走 #%06X · 粗细 %d",palette.route,palette.position,palette.destination,palette.outline,palette.traveled,palette.width)
        sample.invalidate()
    }
    private fun saveColors() {
        prefs.edit().putInt("route",palette.route).putInt("position",palette.position).putInt("destination",palette.destination)
            .putInt("outline",palette.outline).putInt("traveled",palette.traveled).putInt("width",palette.width).apply()
        showColors();changed(route,palette)
    }
    private fun colorDialog(id:String,label:String) {
        val initial=when(id) {"route"->palette.route;"position"->palette.position;"destination"->palette.destination;"outline"->palette.outline;else->palette.traveled}
        val box=LinearLayout(activity).apply {orientation=LinearLayout.VERTICAL;setPadding(28,12,28,12)}
        val input=EditText(activity).apply {setSingleLine(true);hint="#RRGGBB";setText(String.format(Locale.US,"#%06X",initial))};box.addView(input)
        val swatch=View(activity).apply {setBackgroundColor(opaque(initial))};box.addView(swatch,LinearLayout.LayoutParams(-1,60))
        val sliders=ArrayList<SeekBar>()
        for((shift,labelName) in listOf(16 to "红 R",8 to "绿 G",0 to "蓝 B")) {
            box.addView(TextView(activity).apply {text=labelName})
            sliders.add(SeekBar(activity).apply {max=255;progress=(initial shr shift) and 255}.also {box.addView(it)})
        }
        sliders.forEach {bar->bar.setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener {
            override fun onStartTrackingTouch(s:SeekBar) {}
            override fun onStopTrackingTouch(s:SeekBar) {}
            override fun onProgressChanged(s:SeekBar,p:Int,user:Boolean) {
                val value=(sliders[0].progress shl 16) or (sliders[1].progress shl 8) or sliders[2].progress
                input.setText(String.format(Locale.US,"#%06X",value));swatch.setBackgroundColor(opaque(value))
            }
        })}
        val row=LinearLayout(activity)
        for((name,value) in listOf("粉" to 0xff4fb4,"蓝" to 0x008cff,"黄" to 0xffb547,"白" to 0xffffff,"黑" to 0))
            row.addView(Button(activity).apply {text=name;setOnClickListener {
                sliders[0].progress=(value shr 16) and 255;sliders[1].progress=(value shr 8) and 255;sliders[2].progress=value and 255
            }},LinearLayout.LayoutParams(0,-2,1f))
        box.addView(row)
        val dialog=AlertDialog.Builder(activity).setTitle(label).setView(box).setNegativeButton("取消",null).setPositiveButton("应用并保存",null).create()
        dialog.setOnShowListener {dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val raw=input.text.toString().trim().removePrefix("#")
            if(!raw.matches(Regex("[0-9a-fA-F]{6}"))) {input.error="输入6位颜色，例如 #FF4FB4";return@setOnClickListener}
            val value=raw.toInt(16)
            palette=when(id) {"route"->palette.copy(route=value);"position"->palette.copy(position=value);"destination"->palette.copy(destination=value);"outline"->palette.copy(outline=value);else->palette.copy(traveled=value)}
            saveColors();dialog.dismiss()
        }};dialog.show()
    }
    private fun ready():Boolean {
        if(!enabled() || currentFix()==null) {state.text="请先开始同步，并等待有效 GPS，再选择目的地";return false}
        return true
    }
    private fun searchDialog() {
        if(!ready()) return
        val box=LinearLayout(activity).apply {orientation=LinearLayout.VERTICAL;setPadding(28,12,28,12)}
        val input=EditText(activity).apply {hint="景点或地点名称";setSingleLine(true)}
        val city=EditText(activity).apply {hint="城市（可选，例如南京）";setSingleLine(true);setText(prefs.getString("city",""))}
        box.addView(input);box.addView(city)
        val dialog=AlertDialog.Builder(activity).setTitle("搜索目的地").setView(box).setNegativeButton("取消",null).setPositiveButton("搜索",null).create()
        dialog.setOnShowListener {dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            if(input.text.isBlank()) {input.error="请输入地点名称";return@setOnClickListener}
            val query=input.text.toString().trim();val region=city.text.toString().trim()
            prefs.edit().putString("city",region).apply();dialog.dismiss()
            task("正在搜索目的地…",{WalkingRoutePlanner(activity.applicationContext).search(query,region)}) {places->
                if(places.isEmpty()) {state.text="未找到带坐标的地点，可缩短名称、填写城市或使用坐标入口"}
                else AlertDialog.Builder(activity).setTitle("选择目的地（核对地址）")
                    .setItems(places.map {it.name+"\n"+it.address}.toTypedArray()) {_,index->plan(places[index])}
                    .setNegativeButton("取消",null).show()
            }
        }};dialog.show()
    }
    private fun coordinateDialog() {
        if(!ready()) return
        val box=LinearLayout(activity).apply {orientation=LinearLayout.VERTICAL;setPadding(28,12,28,12)}
        box.addView(TextView(activity).apply {text="请输入高德 GCJ-02 坐标，仍通过高德规划真实步行路线。"})
        val name=EditText(activity).apply {hint="目的地名称"};box.addView(name)
        val lat=EditText(activity).apply {hint="纬度，例如 32.15";inputType=InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL or InputType.TYPE_NUMBER_FLAG_SIGNED};box.addView(lat)
        val lng=EditText(activity).apply {hint="经度，例如 118.96";inputType=lat.inputType};box.addView(lng)
        val dialog=AlertDialog.Builder(activity).setTitle("按坐标选择目的地").setView(box).setNegativeButton("取消",null).setPositiveButton("规划步行路线",null).create()
        dialog.setOnShowListener {dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val point=RoutePoint(lat.text.toString().toDoubleOrNull() ?: Double.NaN,lng.text.toString().toDoubleOrNull() ?: Double.NaN)
            if(!point.valid()) {lat.error="请检查经纬度";return@setOnClickListener}
            dialog.dismiss();plan(WalkingRoutePlanner.Place(name.text.toString().ifBlank {"目的地"},"",point))
        }};dialog.show()
    }
    private fun plan(place:WalkingRoutePlanner.Place) {
        if(!ready()) return
        val from=currentFix() ?: return
        task("正在规划前往 ${place.name} 的步行路线…",{WalkingRoutePlanner(activity.applicationContext).plan(from,place)}) {result->
            route=result
            state.text="${result.name}\n规划总长 ${result.meters} m · 预计 ${((result.seconds+59)/60)} 分钟 · ${result.points.size} 点\n等待同步到手表；距离为规划总长，不是实时剩余距离。"
            changed(route,palette)
        }
    }
    private fun <T> task(message:String,work:()->T,done:(T)->Unit) {
        if(pending) {state.text="上一项搜索或算路仍在进行，请稍候";return}
        val token=++serial;pending=true;state.text=message
        worker.execute {
            val result=runCatching(work)
            ui.post {
                if(token!=serial || activity.isDestroyed || !enabled()) return@post
                pending=false
                result.onSuccess(done).onFailure {
                    state.text=if(it is AMapException) "高德搜索/步行算路失败（${it.errorCode}），请检查 Key 的对应服务权限、额度和网络。地图能显示不代表算路权限可用。"
                    else "搜索/算路失败：${if(it is IllegalArgumentException || it is IllegalStateException) it.message else it.javaClass.simpleName}"
                    state.append(if(route!=null) "\n继续保留此前成功的路线。" else "\n当前仍为巡航模式。")
                }
            }
        }
    }
    fun cancelPending() {++serial;pending=false}
    fun close() {cancelPending();worker.shutdownNow();ui.removeCallbacksAndMessages(null)}
}
