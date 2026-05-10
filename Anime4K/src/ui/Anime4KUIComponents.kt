package app.marlboroadvance.mpvex.ui.anime4k

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwitchPreference
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextDecoration
import app.marlboroadvance.mpvex.R
import app.marlboroadvance.mpvex.domain.anime4k.Anime4KManager
import app.marlboroadvance.mpvex.preferences.DecoderPreferences
import `is`.xyz.mpv.MPVLib
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.compose.koinInject

/**
 * Anime4K preference toggle for settings screen
 * Located in: app/src/main/java/app/marlboroadvance/mpvex/ui/preferences/DecoderPreferencesScreen.kt
 */
@Composable
fun Anime4KPreference(
    preferences: DecoderPreferences = koinInject()
) {
    val context = LocalContext.current
    val enableAnime4K by preferences.enableAnime4K.collectAsState()
    val useVulkan by preferences.useVulkan.collectAsState()
    
    SwitchPreference(
        value = enableAnime4K,
        onValueChange = { enabled ->
            preferences.enableAnime4K.set(enabled)
            if (enabled && !useVulkan) {
                // Disable GPU Next if Vulkan is not enabled (compatibility)
                preferences.gpuNext.set(false)
            }
        },
        title = { Text(stringResource(R.string.pref_anime4k_title)) },
        summary = {
            Column {
                Text(
                    stringResource(R.string.pref_anime4k_summary),
                    color = MaterialTheme.colorScheme.outline,
                )
                Text(
                    text = "github.com/bloc97/Anime4K",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                    textDecoration = TextDecoration.Underline,
                    modifier = Modifier.clickable {
                        val intent = Intent(
                            Intent.ACTION_VIEW, 
                            Uri.parse("https://github.com/bloc97/Anime4K")
                        )
                        context.startActivity(intent)
                    }
                )
            }
        },
    )
}

/**
 * Anime4K controls for player "More" sheet
 * Located in: app/src/main/java/app/marlboroadvance/mpvex/ui/player/controls/components/sheets/MoreSheet.kt
 * Lines: 182-289
 */
@Composable
fun Anime4KControls(
    decoderPreferences: DecoderPreferences = koinInject(),
    anime4kManager: Anime4KManager = koinInject(),
    onAnime4KChanged: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    
    val enableAnime4K by decoderPreferences.enableAnime4K.collectAsState()
    val anime4kMode by decoderPreferences.anime4kMode.collectAsState()
    val anime4kQuality by decoderPreferences.anime4kQuality.collectAsState()
    val gpuNext by decoderPreferences.gpuNext.collectAsState()
    val useVulkan by decoderPreferences.useVulkan.collectAsState()
    
    // Only show if Anime4K is enabled and compatible
    if (enableAnime4K && (!gpuNext || useVulkan)) {
        
        // Auto-detect resolution to disable for 4K+
        val width = MPVLib.getPropertyInt("video-params/w") ?: 0
        val height = MPVLib.getPropertyInt("video-params/h") ?: 0
        val isHighRes = width >= 3840 || height >= 2160
        
        // PRESETS (Modes) Section
        Text(
            text = stringResource(R.string.anime4k_mode_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
        
        if (isHighRes) {
            Text(
                text = "Not available for 4K/8K video",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }
        
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.smaller),
        ) {
            items(Anime4KManager.Mode.entries) { mode ->
                FilterChip(
                    label = { Text(stringResource(mode.titleRes)) },
                    selected = anime4kMode == mode.name,
                    enabled = !isHighRes,
                    leadingIcon = null,
                    onClick = {
                        decoderPreferences.anime4kMode.set(mode.name)
                        
                        // Apply shaders immediately (runtime change)
                        scope.launch(Dispatchers.IO) {
                            runCatching {
                                val qualityStr = decoderPreferences.anime4kQuality.get()
                                val quality = try {
                                    Anime4KManager.Quality.valueOf(qualityStr)
                                } catch (e: IllegalArgumentException) {
                                    Anime4KManager.Quality.BALANCED
                                }
                                val currentMode = try {
                                    Anime4KManager.Mode.valueOf(mode.name)
                                } catch (e: IllegalArgumentException) {
                                    Anime4KManager.Mode.OFF
                                }
                                
                                val shaderChain = anime4kManager.getShaderChain(
                                    currentMode, 
                                    quality
                                )
                                
                                // Use setPropertyString for runtime changes
                                MPVLib.setPropertyString(
                                    "glsl-shaders", 
                                    if (shaderChain.isNotEmpty()) shaderChain else ""
                                )
                                onAnime4KChanged()
                            }
                        }
                    }
                )
            }
        }
        
        // QUALITY (Variants) Section
        Text(
            text = stringResource(R.string.anime4k_quality_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
        
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(MaterialTheme.spacing.smaller),
        ) {
            items(Anime4KManager.Quality.entries) { quality ->
                FilterChip(
                    label = { Text(stringResource(quality.titleRes)) },
                    selected = anime4kQuality == quality.name,
                    enabled = anime4kMode != "OFF" && !isHighRes,
                    leadingIcon = null,
                    onClick = {
                        decoderPreferences.anime4kQuality.set(quality.name)
                        
                        // Apply shaders immediately (runtime change)
                        scope.launch(Dispatchers.IO) {
                            runCatching {
                                val modeStr = decoderPreferences.anime4kMode.get()
                                val modeEnum = try {
                                    Anime4KManager.Mode.valueOf(modeStr)
                                } catch (e: IllegalArgumentException) {
                                    Anime4KManager.Mode.OFF
                                }
                                val currentQuality = try {
                                    Anime4KManager.Quality.valueOf(quality.name)
                                } catch (e: IllegalArgumentException) {
                                    Anime4KManager.Quality.BALANCED
                                }
                                
                                val shaderChain = anime4kManager.getShaderChain(
                                    modeEnum, 
                                    currentQuality
                                )
                                
                                // Use setPropertyString for runtime changes
                                MPVLib.setPropertyString(
                                    "glsl-shaders", 
                                    if (shaderChain.isNotEmpty()) shaderChain else ""
                                )
                                onAnime4KChanged()
                            }
                        }
                    }
                )
            }
        }
    }
}

/**
 * MPVView Anime4K shader application function
 * Located in: app/src/main/java/app/marlboroadvance/mpvex/ui/player/MPVView.kt
 * Lines: 324-382
 * 
 * This function is called during initOptions() to apply Anime4K shaders
 * before video playback begins.
 */
/*
fun MPVView.applyAnime4KShaders() {
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
        
        // Initialize shader files if needed
        if (!anime4kManager.initialize()) {
            return
        }
        
        // Get preferences
        val modeStr = decoderPreferences.anime4kMode.get()
        
        // Check if mode is OFF
        if (modeStr == "OFF") {
            return
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
*/
