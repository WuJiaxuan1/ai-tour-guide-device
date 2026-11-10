package com.example.motonav

import android.graphics.Color
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
        text("枫叶精灵 · 连接测试", 24f)
        text("P2-test01｜手机开启热点，StopWatch 连接该热点。输入手表屏幕上的 IP 后检查连接。")
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
        button("停止连接检测") { disconnect("已停止连接检测") }
        state = text("尚未连接")
        counts = text("本次确认 0 条，失败 0 条")
        once = button("发送 1 条测试消息") { send(1) }
        ten = button("连续发送 10 条") { send(10) }
        once.isEnabled = false; ten.isEnabled = false
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
        nextSeq = 1; successes = 0; failures = 0; lastBoot = ""
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
                    state.text = "通信可用 · ${status.firmware}\n手表累计收到 ${status.received} 条，最近编号 ${status.lastSeq}"
                    updateButtons()
                }
            } catch (error: Exception) {
                publish(token) {
                    if (available) addLog("连接中断，正在重试")
                    available = false
                    state.text = "暂时无法连接，每 3 秒重试\n检查手机热点、手表 IP 和 P2 固件。\n${error.message?.take(160)}"
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

    private fun disconnect(message: String) {
        generation++
        monitor?.cancel(true); monitor = null
        client?.cancel(); client = null
        testing = false; available = false
        state.text = message
        updateButtons()
    }

    private fun updateButtons() { once.isEnabled = available && !testing; ten.isEnabled = available && !testing }

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
