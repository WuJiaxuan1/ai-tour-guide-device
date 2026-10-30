package com.example.motonav

import kotlin.math.roundToInt

/** Half-level controls; keep the exported bounds within the geographic protocol limit. */
object MapZoom {
    const val MIN = 13f
    const val MAX = 18f
    const val DEFAULT = 14f
    const val STEPS = 10
    fun normalize(value: Float): Float =
        if (!value.isFinite()) DEFAULT else MIN + ((value.coerceIn(MIN, MAX)-MIN)*2).roundToInt()/2f
    fun progress(value: Float) = ((normalize(value)-MIN)*2).roundToInt()
    fun fromProgress(value: Int) = MIN + value.coerceIn(0, STEPS)/2f
}
