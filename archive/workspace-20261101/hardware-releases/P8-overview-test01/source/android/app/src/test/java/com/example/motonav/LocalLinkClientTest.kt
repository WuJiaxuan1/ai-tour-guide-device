package com.example.motonav

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

class LocalLinkClientTest {
    private lateinit var server: ServerSocket
    private val executor = Executors.newCachedThreadPool()
    private lateinit var client: LocalLinkClient
    private val session = "0123456789abcdef0123456789abcdef"
    private data class Request(val method: String, val path: String, val bytes: ByteArray) {
        val body get() = String(bytes, Charsets.UTF_8)
    }
    private val response = AtomicReference<(Request) -> Pair<Int, String>>()
    private val sockets = ConcurrentLinkedQueue<Socket>()
    private val errors = ConcurrentLinkedQueue<Throwable>()

    @Before fun start() {
        server = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        response.set { 200 to status().toString() }
        executor.execute {
            while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: SocketException) { break }
                sockets.add(socket)
                executor.execute {
                    try {
                        socket.soTimeout = 2000
                        val input = socket.getInputStream().buffered()
                        val header = StringBuilder()
                        while (!header.endsWith("\r\n\r\n")) {
                            val byte = input.read()
                            if (byte < 0 || header.length > 8192) throw IOException("Bad test request")
                            header.append(byte.toChar())
                        }
                        val lines = header.toString().split("\r\n")
                        val first = lines.first().split(' ')
                        val length = lines.firstOrNull { it.startsWith("Content-Length:", true) }
                            ?.substringAfter(':')?.trim()?.toInt() ?: 0
                        val body = ByteArray(length)
                        var read = 0
                        while (read < length) {
                            val count = input.read(body, read, length - read)
                            if (count < 0) throw IOException("Incomplete test request")
                            read += count
                        }
                        val request = Request(first[0], first[1], body)
                        val (code, text) = response.get().invoke(request)
                        val bytes = text.toByteArray(Charsets.UTF_8)
                        socket.getOutputStream().use { output ->
                            output.write("HTTP/1.1 $code Test\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(Charsets.US_ASCII))
                            output.write(bytes)
                        }
                    } catch (_: InterruptedException) {
                        Thread.currentThread().interrupt()
                    } catch (_: SocketException) {
                        // Expected when a timeout/cancel test closes its client.
                    } catch (error: Throwable) { errors.add(error) }
                    finally { socket.close(); sockets.remove(socket) }
                }
            }
        }
        client = LocalLinkClient("http://127.0.0.1:${server.localPort}")
    }

    @After fun stop() {
        client.cancel(); server.close(); sockets.forEach { it.close() }; executor.shutdownNow()
        executor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS)
        assertTrue("HTTP fixture errors: $errors", errors.isEmpty())
    }

    private fun status() = JSONObject().put("service", "qixia-stopwatch").put("protocol", 1)
        .put("firmware", "2.2.6-p2-test01").put("boot_id", "0123456789abcdef")
        .put("received_count", 0).put("last_seq", 0)

    private fun echo(request: Request): JSONObject {
        assertEquals("POST", request.method)
        assertEquals("/api/v1/echo", request.path)
        val ping = JSONObject(request.body)
        return status().put("type", "ack").put("session", ping.getString("session"))
            .put("seq", ping.getInt("seq")).put("message", ping.getString("message")).put("received_count", 1)
    }

    private fun expectIo(block: () -> Unit) {
        try { block(); fail("Expected transport failure") } catch (_: IOException) { }
    }

    @Test fun validatesStatusAndRoundTripsChineseText() {
        assertEquals("2.2.6-p2-test01", client.status().firmware)
        response.set { 200 to echo(it).toString() }
        val ack = client.ping(session, 7, "枫叶精灵收到请回答")
        assertEquals(1L, ack.received)
        assertTrue(ack.elapsedMs >= 0)
    }

    @Test fun routeIsSeparateBinaryRequestWithMatchingAcknowledgment() {
        val route=WalkingRoute("destination",RoutePoint(32.0,118.81),listOf(RoutePoint(32.0,118.8),RoutePoint(32.0,118.81)),1000,800)
        val frame=RouteWire.encode(route,RoutePalette(),7,session)
        val ack=status().put("type","route_received").put("revision",7).put("session",session).put("crc32",frame.crc)
        response.set {
            assertEquals("/api/v1/route",it.path);assertEquals("POST",it.method);assertArrayEquals(frame.bytes,it.bytes)
            200 to ack.toString()
        }
        assertEquals("0123456789abcdef",client.uploadRoute(frame))
        for((key,value) in listOf("revision" to 8,"session" to "bad","crc32" to 0,"type" to "image_received")) {
            response.set {200 to JSONObject(ack.toString()).put(key,value).toString()}
            expectIo {client.uploadRoute(frame)}
        }
    }
    @Test fun advertisesRouteCapabilityWithoutMistakingOldFirmware() {
        assertEquals(0,client.status().routeProtocol)
        response.set {200 to status().put("route_protocol",1).put("route_revision",7).put("route_session",session).toString()}
        val result=client.status();assertEquals(1,result.routeProtocol);assertEquals(7L,result.routeRevision);assertEquals(session,result.routeSession)
    }
    @Test fun routeProgressTravelsWithPositionAndMustBeAcknowledged() {
        response.set {
            assertEquals("/api/v1/position",it.path);assertTrue(it.bytes.size<=384)
            val body=JSONObject(it.body);assertEquals(7,body.getInt("route_revision"));assertEquals(.375,body.getDouble("route_progress"),0.0)
            200 to status().put("type","position_received").put("session",session).put("frame_id",25).put("seq",1)
                .put("route_revision",7).put("route_progress",.375).toString()
        }
        assertEquals("0123456789abcdef",client.position(session,25,1,PhoneFix(32.0,118.8,5.0,1000),1000,7,.375))
        response.set {200 to status().put("type","position_received").put("session",session).put("frame_id",25).put("seq",2)
            .put("route_revision",6).put("route_progress",.375).toString()}
        expectIo {client.position(session,25,2,null,20000,7,.375)}
        response.set {200 to status().put("route_progress_protocol",1).toString()}
        assertEquals(1,client.status().progressProtocol)
    }
    @Test fun uploadsExactBinaryFrameAndChecksAcknowledgment() {
        val frame = MapFrameEncoder.encode(IntArray(240 * 240) { 0xff00ff00.toInt() }, 19, session)
        response.set {
            assertEquals("POST", it.method); assertEquals("/api/v1/image", it.path)
            assertArrayEquals(frame.bytes, it.bytes)
            200 to status().put("type", "image_received").put("state", "queued")
                .put("session", session).put("frame_id", 19).put("crc32", frame.crc).toString()
        }
        assertEquals("0123456789abcdef", client.uploadImage(frame).bootId)
    }

    @Test fun rejectsWrongImageAckAndClosedMapPage() {
        val frame = MapFrameEncoder.encode(IntArray(240 * 240), 19, session)
        val ack = status().put("type", "image_received").put("state", "queued")
            .put("session", session).put("frame_id", 19).put("crc32", frame.crc)
        for ((key, value) in listOf("frame_id" to 20, "crc32" to 0, "session" to "bad", "state" to "displayed")) {
            response.set { 200 to JSONObject(ack.toString()).put(key, value).toString() }
            expectIo { client.uploadImage(frame) }
        }
        response.set { 409 to "{}" }
        expectIo { client.uploadImage(frame) }
    }

    @Test fun readsImageStateWithoutBreakingOldStatus() {
        assertEquals(0, client.status().imageProtocol)
        response.set { 200 to status().put("image_protocol", 1).put("map_active", true)
            .put("image_displayed_id", 19).put("image_session", session).toString() }
        val result = client.status()
        assertTrue(result.mapActive); assertEquals(19L, result.displayedImage); assertEquals(session, result.imageSession)
    }

    @Test fun rejectsWrongSequenceAndSession() {
        response.set { 200 to echo(it).put("seq", 8).toString() }
        expectIo { client.ping(session, 7) }
        response.set { 200 to echo(it).put("session", "ffffffffffffffffffffffffffffffff").toString() }
        expectIo { client.ping(session, 7) }
    }

    @Test fun rejectsWrongServiceProtocolAndFractionalCounter() {
        response.set { 200 to status().put("service", "different-device").toString() }
        expectIo { client.status() }
        response.set { 200 to status().put("protocol", 2).toString() }
        expectIo { client.status() }
        response.set { 200 to status().put("received_count", 1.5).toString() }
        expectIo { client.status() }
    }

    @Test fun rejectsMalformedAndOversizedReplies() {
        response.set { 200 to "not JSON" }
        expectIo { client.status() }
        response.set { 200 to "x".repeat(5000) }
        expectIo { client.status() }
    }

    @Test fun failureDoesNotPreventNextRequestFromRecovering() {
        response.set { 503 to "temporarily unavailable" }
        expectIo { client.status() }
        response.set { 200 to status().toString() }
        assertEquals(0L, client.status().received)
    }

    @Test fun detectsRebootWithoutRejectingNewBootId() {
        val first = client.status().bootId
        response.set { 200 to status().put("boot_id", "fedcba9876543210").toString() }
        assertNotEquals(first, client.status().bootId)
    }

    @Test fun cancellationIsTerminalForOldConnection() {
        client.cancel()
        expectIo { client.status() }
        expectIo { client.ping(session, 1) }
    }

    @Test fun responseTimeoutIsBounded() {
        response.set { Thread.sleep(4000); 200 to status().toString() }
        val before = System.nanoTime()
        expectIo { client.status() }
        assertTrue((System.nanoTime() - before) / 1_000_000 < 3800)
    }

    @Test fun sendsPositionOnlyForCurrentMapAndRejectsMismatchedAck() {
        response.set {
            assertEquals("/api/v1/position",it.path)
            val body=JSONObject(it.body)
            assertTrue(body.getBoolean("valid"));assertEquals(1000,body.getInt("age_ms"))
            assertEquals(32.005,body.getDouble("lat"),0.0)
            200 to status().put("type","position_received").put("session",session).put("frame_id",24).put("seq",1).toString()
        }
        val fix=PhoneFix(32.005,118.795,8.0,1000)
        assertEquals("0123456789abcdef",client.position(session,24,1,fix,2000))
        response.set {200 to status().put("type","position_received").put("session",session).put("frame_id",23).put("seq",1).toString()}
        expectIo {client.position(session,24,1,fix,2000)}
        response.set {
            val body=JSONObject(it.body)
            assertFalse(body.getBoolean("valid"));assertEquals(0.0,body.getDouble("lat"),0.0)
            200 to status().put("type","position_received").put("session",session).put("frame_id",24).put("seq",2).toString()
        }
        client.position(session,24,2,fix,17000)
    }

    @Test fun uploadsGeoFrameAndNegotiatesCapability() {
        response.set {200 to status().put("geo_protocol",1).toString()}
        assertEquals(1,client.status().geoProtocol)
        val frame=MapFrameEncoder.encode(IntArray(240*240),24,session,GeoBounds(32.01,118.79,32.0,118.8))
        response.set {
            assertArrayEquals(frame.bytes,it.bytes)
            200 to status().put("type","image_received").put("state","queued").put("session",session)
                .put("frame_id",24).put("crc32",frame.crc).toString()
        }
        client.uploadImage(frame)
    }

    @Test fun validatesAndNormalizesUserAddress() {
        assertEquals("http://192.168.43.1:8765", LocalLinkClient.address(" 192.168.043.001 "))
        for (input in listOf("", "example.com", "192.168.1.999", "127.0.0.1", "192.168.1.1:8765", "192.168..1")) {
            try { LocalLinkClient.address(input); fail("Accepted $input") }
            catch (_: IllegalArgumentException) { }
        }
    }
}
