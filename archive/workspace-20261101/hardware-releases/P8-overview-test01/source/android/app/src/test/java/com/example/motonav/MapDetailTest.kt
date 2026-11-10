package com.example.motonav
import org.junit.Assert.*
import org.junit.Test
class MapDetailTest {
    @Test fun restore() { for (m in MapDetail.entries) assertEquals(m,MapDetail.restore(m.name)); assertEquals(MapDetail.CLEAN,MapDetail.restore("bad")) }
    @Test fun cleanHidesText() { assertTrue(MapDetail.STANDARD.showText); assertFalse(MapDetail.CLEAN.showText) }
}
