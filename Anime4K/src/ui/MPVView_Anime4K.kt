package app.marlboroadvance.mpvex.ui.player

import android.content.Context
import android.util.AttributeSet
import app.marlboroadvance.mpvex.domain.anime4k.Anime4KManager
import app.marlboroadvance.mpvex.preferences.DecoderPreferences
import `is`.xyz.mpv.BaseMPVView
import `is`.xyz.mpv.MPVLib
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject

/**
 * Anime4K Integration in MPVView
 * 
 * File: app/src/main/java/app/marlboroadvance/mpvex/ui/player/MPVView.kt
 * 
 * This file documents the Anime4K-related portions of MPVView class.
 */

class MPVView_Anime4K : BaseMPVView, KoinComponent {
    
    // Dependencies injected via Koin
    private val decoderPreferences: DecoderPreferences by inject()
    private val anime4kManager: Anime4KManager by inject()
    
    constructor(context: Context, attributes: AttributeSet) : super(context, attributes)
    
    /**
     * Initialize MPV options including Anime4K shaders
     * Called during player initialization before video file is loaded
     */
    fun initOptions() {
        // ... other options ...
        
        // Anime4K shader initialization (MUST be in initOptions, not after file load!)
        applyAnime4KShaders()
        
        // ... other options ...
    }
    
    /**
     * Apply Anime4K GLSL shaders to mpv
     * 
     * This function:
     * 1. Checks if Anime4K is enabled in preferences
     * 2. Validates GPU compatibility (avoids gpu-next on non-Vulkan)
     * 3. Initializes shader files from assets to internal storage
     * 4. Builds shader chain based on selected mode and quality
     * 5. Applies shaders via mpv's glsl-shaders option
     * 
     * Critical: Must be called in initOptions(), NOT after file load
     */
    fun applyAnime4KShaders() {
        runCatching {
            val enabled = decoderPreferences.enableAnime4K.get()
            if (!enabled) {
                return
            }
            
            // Anime4K requires the legacy GPU path unless gpu-next is running on Vulkan.
            val gpuNextActive = decoderPreferences.gpuNext.get()
            val useVulkan = decoderPreferences.useVulkan.get()
            if (gpuNextActive && !useVulkan) {
                return  // Abort shader loading to prevent incompatible state
            }
            
            // Initialize shader files if needed - THIS IS CRITICAL!
            if (!anime4kManager.initialize()) {
                return
            }
            
            // Get preferences
            val modeStr = decoderPreferences.anime4kMode.get()
            
            // Check if mode is OFF - if so, don't apply any shaders
            if (modeStr == "OFF") {
                return  // Exit early - user wants it OFF
            }
            
            // Parse user's selected mode
            val mode = try {
                Anime4KManager.Mode.valueOf(modeStr)
            } catch (e: IllegalArgumentException) {
                Anime4KManager.Mode.OFF
            }
            
            val qualityStr = decoderPreferences.anime4kQuality.get()
            val quality = try {
                Anime4KManager.Quality.valueOf(qualityStr)
            } catch (e: IllegalArgumentException) {
                Anime4KManager.Quality.BALANCED
            }
            
            // Get shader chain from manager
            val shaderChain = anime4kManager.getShaderChain(mode, quality)
            
            if (shaderChain.isNotEmpty()) {
                // OpenGL-only tuning should not be pushed onto the Vulkan backend.
                if (!useVulkan) {
                    MPVLib.setOptionString("opengl-pbo", "yes")
                    MPVLib.setOptionString("opengl-early-flush", "no")
                }
                MPVLib.setOptionString("vd-lavc-dr", "yes")
                
                // Apply shaders (MUST use setOptionString in initOptions!)
                MPVLib.setOptionString("glsl-shaders", shaderChain)
            }
        }.onFailure {
            // Don't crash - just continue without shaders
        }
    }
}

/**
 * Key integration points in MPVView:
 * 
 * 1. Import statement (line 14):
 *    import app.marlboroadvance.mpvex.domain.anime4k.Anime4KManager
 * 
 * 2. Dependency injection (line 34):
 *    private val anime4kManager: Anime4KManager by inject()
 * 
 * 3. initOptions() call (line 142):
 *    applyAnime4KShaders()
 * 
 * 4. Function definition (lines 324-382)
 * 
 * GPU Compatibility Logic:
 * - If gpu-next is enabled AND Vulkan is NOT enabled: skip shader loading
 * - If Vulkan IS enabled: can use gpu-next + Anime4K together
 * - If OpenGL (legacy): use "opengl-pbo=yes" and "opengl-early-flush=no"
 * 
 * MPV Options Set:
 * - glsl-shaders: Colon-separated list of shader file paths
 * - opengl-pbo: yes (OpenGL only)
 * - opengl-early-flush: no (OpenGL only)  
 * - vd-lavc-dr: yes (Direct rendering)
 */
