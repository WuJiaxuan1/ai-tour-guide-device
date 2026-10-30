package com.example.motonav

import android.content.SharedPreferences
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.lang.reflect.Proxy

class AmapKeyStoreTest {
    // Separate RAM and durable state: Android apply() updates only the former immediately.
    private class Disk(var value:String="",var fail:Boolean=false,var wrongReadback:Boolean=false) {
        var commits=0
        var applies=0
        fun process(): SharedPreferences {
            var memory=value
            lateinit var preferences:SharedPreferences
            preferences=Proxy.newProxyInstance(SharedPreferences::class.java.classLoader,arrayOf(SharedPreferences::class.java)) {_,method,args ->
                when(method.name) {
                    "getString" -> memory
                    "edit" -> {
                        var staged=memory
                        lateinit var editor:SharedPreferences.Editor
                        editor=Proxy.newProxyInstance(SharedPreferences.Editor::class.java.classLoader,arrayOf(SharedPreferences.Editor::class.java)) {_,m,a ->
                            when(m.name) {
                                "putString" -> {staged=a!![1] as String;editor}
                                "remove" -> editor
                                "apply" -> {applies++;memory=staged;null}
                                "commit" -> {commits++;memory=staged;if(!fail)value=staged;if(wrongReadback)memory="";!fail}
                                else -> throw UnsupportedOperationException(m.name)
                            }
                        } as SharedPreferences.Editor
                        editor
                    }
                    else -> throw UnsupportedOperationException(method.name)
                }
            } as SharedPreferences
            return preferences
        }
    }
    @Test fun savedKeySurvivesFreshProcessAndCanBeReplaced() {
        val disk=Disk()
        val first=AmapKeyStore(disk.process())
        first.save("  test-key-first  ")
        assertEquals("test-key-first",AmapKeyStore(disk.process()).read())
        AmapKeyStore(disk.process()).save("test-key-second")
        assertEquals("test-key-second",AmapKeyStore(disk.process()).read())
        assertEquals(2,disk.commits);assertEquals(0,disk.applies)
    }
    @Test fun failedDiskWriteIsNotReportedAsSavedDespiteRamUpdate() {
        val disk=Disk("old-key",fail=true)
        try {AmapKeyStore(disk.process()).save("new-key");fail("must reject failed disk commit")} catch(_:IOException) {}
        assertEquals("old-key",AmapKeyStore(disk.process()).read())
    }
    @Test fun rejectsInvalidInputWithoutReplacingSavedKey() {
        val disk=Disk("old-key")
        for(input in listOf("  ","two parts","a\nb")) {
            try {AmapKeyStore(disk.process()).save(input);fail("must reject invalid input")} catch(_:IllegalArgumentException) {}
        }
        assertEquals("old-key",disk.value);assertEquals(0,disk.commits)
    }
    @Test fun detectsFailedReadback() {
        val disk=Disk(wrongReadback=true)
        try {AmapKeyStore(disk.process()).save("test-key");fail("must reject mismatched readback")} catch(_:IOException) {}
    }
}
