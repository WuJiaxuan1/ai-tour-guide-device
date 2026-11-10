package com.example.motonav

import android.graphics.Color
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/** A deliberately small first screen for the phone-hotspot acceptance test. */
class LocalLinkActivity : AppCompatActivity() {
    private val ui = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadScheduledExecutor()
    private var monitor: ScheduledFuture<*>? = null
    private var client: LocalLinkClient? = null
    private var generation = 0L
    private var session = ""
    private var nextSeq = 1
    private var testing = false
    private var available = false
    private var lastBoot = ""
    private lateinit var address: EditText
    private lateinit var state: TextView
    private lateinit var counts: TextView
    private lateinit var log: TextView
    private lateinit var once: Button
    private lateinit var ten: Button
    private lateinit var imageA: Button
    private lateinit var imageB: Button
    private lateinit var preview: ImageView
    private var imageAvailable = false
    private var nextImage = 1
    private val lines = ArrayDeque<String>()
    private var successes = 0
    private var failures = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        val padding = (20 * resources.displayMetrics.density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
        }
        fun text(value: String, size: Float = 16f) = TextView(this).apply {
            text = value; textSize = size; setTextColor(Color.WHITE); setPadding(0, 10, 0, 10)
        }.also { content.addView(it) }
        text("枫叶精灵 · 图像测试", 24f)
        text("P6-test01｜手机开启热点，手表连接后输入 IP。发送图像前，在手表向左滑或按右键进入地图页。")
        address = EditText(this).apply {
            hint = "手表 IP（例如 192.168.43.123）"
            inputType = InputType.TYPE_CLASS_PHONE
            setSingleLine(true)
            setText(getSharedPreferences("local_link", MODE_PRIVATE).getString("ip", ""))
        }
        content.addView(address)
        fun button(label: String, action: () -> Unit) = Button(this).apply {
            text = label; setOnClickListener { action() }
        }.also { content.addView(it) }
        button("检查连接 / 更换 IP") { connect() }
        button("停止发送 / 断开检测") { disconnect("已停止；未获确认的图像请以手表实际显示为准") }
        state = text("尚未连接")
        counts = text("本次确认 0 条，失败 0 条")
        once = button("发送 1 条测试消息") { send(1) }
        ten = button("连续发送 10 条") { send(10) }
        once.isEnabled = false; ten.isEnabled = false
        text("下面是合成测试图，不是真实地图，不使用定位或高德 Key。色块用来检查颜色，N 箭头指向画面上方。", 14f)
        preview = ImageView(this).apply {
            adjustViewBounds = true
            contentDescription = "合成测试图预览，非真实地图"
        }
        content.addView(preview, LinearLayout.LayoutParams(-1, (240 * resources.displayMetrics.density).toInt()))
        imageA = button("发送测试图 A") { sendImage(false) }
        imageB = button("发送测试图 B") { sendImage(true) }
        imageA.isEnabled = false; imageB.isEnabled = false
        text("每条消息都由手表返回同一编号进行确认。热点断开后会重试；如果手表 IP 改变，请重新输入。离开此页面后暂停检测。", 14f)
        log = text("", 13f).apply { setTextIsSelectable(true) }
        setContentView(ScrollView(this).apply { addView(content) })
        // Keep controls clear of Android 15's system bars and keyboard.
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() or
                androidx.core.view.WindowInsetsCompat.Type.ime())
            view.setPadding(padding + bars.left, padding + bars.top, padding + bars.right, padding + bars.bottom)
            insets
        }
    }

    private fun connect() {
        val endpoint = try { LocalLinkClient.address(address.text.toString()) }
        catch (error: IllegalArgumentException) { state.text = error.message; return }
        disconnect("正在检查连接…")
        getSharedPreferences("local_link", MODE_PRIVATE).edit().putString("ip", address.text.toString().trim()).apply()
        val local = LocalLinkClient(endpoint)
        client = local
        val token = generation
        session = UUID.randomUUID().toString().replace("-", "")
        nextSeq = 1; nextImage = 1; successes = 0; failures = 0; lastBoot = ""
        counts.text = "本次确认 0 条，失败 0 条"
        addLog("检查 $endpoint")
        monitor = worker.scheduleWithFixedDelay({
            try {
                val status = local.status()
                publish(token) {
                    if (!available) addLog("通信可用：${status.firmware}")
                    if (lastBoot.isNotEmpty() && lastBoot != status.bootId) addLog("检测到手表重启，设备接收计数已重新开始")
                    lastBoot = status.bootId
                    available = true
                    imageAvailable = status.imageProtocol == 1 && status.mapActive
                    val imageState = if (status.imageProtocol != 1) "图像功能需要 P6 固件"
                        else if (status.mapActive) "地图页已打开，可以发图；已显示图像 #${status.displayedImage}"
                        else "请在手表向左滑或按右键进入地图页"
                    state.text = "通信可用 · ${status.firmware}\n$imageState\n测试消息累计 ${status.received} 条"
                    updateButtons()
                }
            } catch (error: Exception) {
                publish(token) {
                    if (available) addLog("连接中断，正在重试")
                    available = false
                    imageAvailable = false
                    state.text = "暂时无法连接，每 3 秒重试\n检查手机热点、手表 IP 和固件。\n${error.message?.take(160)}"
                    updateButtons()
                }
            }
        }, 0, 3, TimeUnit.SECONDS)
    }

    private fun send(count: Int) {
        val local = client ?: return
        if (!available || testing) return
        val token = generation
        val localSession = session
        val first = nextSeq
        nextSeq += count
        testing = true; updateButtons()
        addLog("开始发送 $count 条，编号 $first～${first + count - 1}")
        worker.execute {
            try {
                for (offset in 0 until count) {
                    val seq = first + offset
                    try {
                        val ack = local.ping(localSession, seq)
                        publish(token) {
                            successes++
                            if (lastBoot.isNotEmpty() && lastBoot != ack.bootId) addLog("本次确认来自重启后的手表")
                            lastBoot = ack.bootId
                            addLog("#$seq 已确认，${ack.elapsedMs} ms；手表累计 ${ack.received}")
                            counts.text = "本次确认 $successes 条，失败 $failures 条"
                        }
                    } catch (error: Exception) {
                        publish(token) {
                            failures++
                            available = false
                            addLog("#$seq 未获确认：${error.message?.take(120)}；停止本组，不自动重发")
                            counts.text = "本次确认 $successes 条，失败 $failures 条"
                            state.text = "本组测试中断，等待连接检测恢复"
                        }
                        break
                    }
                    if (offset + 1 < count) Thread.sleep(600)
                }
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            } finally {
                publish(token) { testing = false; updateButtons() }
            }
        }
    }

    private fun publish(token: Long, action: () -> Unit) {
        ui.post { if (token == generation && !isFinishing && !isDestroyed) action() }
    }

    private fun sendImage(variantB: Boolean) {
        val local = client ?: return
        if (!available || !imageAvailable || testing) return
        val token = generation
        val id = nextImage++
        val bitmap = testImage(variantB, id)
        preview.setImageBitmap(bitmap)
        val pixels = IntArray(240 * 240)
        bitmap.getPixels(pixels, 0, 240, 0, 0, 240, 240)
        val frame = MapFrameEncoder.encode(pixels, id, session)
        testing = true; updateButtons()
        addLog("发送测试图 ${if (variantB) "B" else "A"} #$id，等待接收和显示确认")
        worker.execute {
            try {
                val ack = local.uploadImage(frame)
                publish(token) { addLog("#$id 完整接收并通过校验，${ack.elapsedMs} ms；正在确认显示") }
                var shown = false
                for (attempt in 0 until 12) {
                    val status = local.status()
                    if (status.bootId != ack.bootId) throw java.io.IOException("手表已重启，本次显示未确认")
                    if (status.imageSession == frame.session && status.displayedImage == id.toLong()) {
                        shown = true; break
                    }
                    if (!status.mapActive) throw java.io.IOException("手表已离开地图页，本次显示未确认")
                    Thread.sleep(500)
                }
                if (!shown) throw java.io.IOException("已接收，但尚未取得显示确认，请观察手表")
                publish(token) { addLog("#$id 手表已装载完整图像，请对照预览检查颜色与方向") }
            } catch (error: Exception) {
                if (error is InterruptedException) Thread.currentThread().interrupt()
                publish(token) { addLog("#$id 图像测试未完成：${error.message?.take(160)}；不自动重发") }
            } finally {
                publish(token) { testing = false; updateButtons() }
            }
        }
    }

    private fun testImage(variantB: Boolean, id: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(240, 240, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        canvas.drawColor(if (variantB) Color.rgb(32, 42, 76) else Color.rgb(25, 60, 48))
        for (x in 0..240 step 30) {
            paint.color = Color.rgb(80, 100, 100); paint.strokeWidth = 1f
            canvas.drawLine(x.toFloat(), 34f, x.toFloat(), 208f, paint)
            canvas.drawLine(0f, x.toFloat(), 240f, x.toFloat(), paint)
        }
        listOf(Color.RED, Color.GREEN, Color.BLUE).forEachIndexed { i, color ->
            paint.color = color; canvas.drawRect(i * 80f, 0f, (i + 1) * 80f, 30f, paint)
        }
        paint.color = Color.WHITE; paint.textSize = 16f
        canvas.drawText("TL", 8f, 52f, paint); canvas.drawText("TR", 210f, 52f, paint)
        canvas.drawText("BL", 8f, 202f, paint); canvas.drawText("BR", 210f, 202f, paint)
        paint.color = if (variantB) Color.CYAN else Color.YELLOW
        val arrow = Path().apply { moveTo(120f, 67f); lineTo(147f, 117f); lineTo(129f, 110f)
            lineTo(129f, 162f); lineTo(111f, 162f); lineTo(111f, 110f); lineTo(93f, 117f); close() }
        canvas.drawPath(arrow, paint)
        paint.color = Color.WHITE; paint.textSize = 18f
        canvas.drawText("N", 113f, 62f, paint)
        paint.color = if (variantB) Color.MAGENTA else Color.rgb(255, 150, 40)
        canvas.drawCircle(if (variantB) 180f else 60f, 170f, 13f, paint)
        paint.color = Color.BLACK; canvas.drawRect(0f, 210f, 240f, 240f, paint)
        paint.color = Color.WHITE; paint.textSize = 16f
        canvas.drawText("TEST ${if (variantB) "B" else "A"}  #$id", 53f, 231f, paint)
        return bitmap
    }

    private fun disconnect(message: String) {
        generation++
        monitor?.cancel(true); monitor = null
        client?.cancel(); client = null
        testing = false; available = false; imageAvailable = false
        state.text = message
        updateButtons()
    }

    private fun updateButtons() {
        once.isEnabled = available && !testing; ten.isEnabled = available && !testing
        imageA.isEnabled = available && imageAvailable && !testing
        imageB.isEnabled = available && imageAvailable && !testing
    }

    private fun addLog(message: String) {
        val stamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        lines.addFirst("$stamp  $message")
        while (lines.size > 40) lines.removeLast()
        log.text = lines.joinToString("\n")
    }

    override fun onStop() {
        disconnect("已暂停。回到页面后点击“检查连接”继续。")
        super.onStop()
    }

    override fun onDestroy() {
        worker.shutdownNow()
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
