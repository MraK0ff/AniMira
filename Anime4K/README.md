# Anime4K Integration for mpvEx

This folder contains all code related to Anime4K upscaling implementation in mpvEx.

## Overview

Anime4K is a state-of-the-art real-time anime upscaling algorithm that uses GLSL shaders to enhance video quality. This implementation is based on [bloc97/Anime4K](https://github.com/bloc97/Anime4K).

## Project Structure

```
Anime4K/
├── README.md                      # This documentation
├── src/
│   ├── domain/
│   │   └── Anime4KManager.kt      # Core shader management
│   ├── preferences/
│   │   └── DecoderPreferences.kt  # Preferences (Anime4K section)
│   ├── di/
│   │   └── DomainModule.kt        # Dependency injection
│   └── ui/
│       └── (UI related code in original paths)
├── shaders/                       # GLSL shader files
│   ├── Anime4K_Clamp_Highlights.glsl
│   ├── Anime4K_AutoDownscalePre_x2.glsl
│   ├── Anime4K_Restore_CNN_S.glsl
│   ├── Anime4K_Restore_CNN_M.glsl
│   ├── Anime4K_Restore_CNN_L.glsl
│   ├── Anime4K_Restore_CNN_Soft_S.glsl
│   ├── Anime4K_Restore_CNN_Soft_M.glsl
│   ├── Anime4K_Restore_CNN_Soft_L.glsl
│   ├── Anime4K_Upscale_CNN_x2_S.glsl
│   ├── Anime4K_Upscale_CNN_x2_M.glsl
│   ├── Anime4K_Upscale_CNN_x2_L.glsl
│   ├── Anime4K_Upscale_Denoise_CNN_x2_S.glsl
│   ├── Anime4K_Upscale_Denoise_CNN_x2_M.glsl
│   └── Anime4K_Upscale_Denoise_CNN_x2_S.glsl
└── res/
    └── values/
        └── strings_anime4k.xml    # String resources

```

## Core Components

### 1. Anime4KManager.kt
**Location:** `src/domain/Anime4KManager.kt`

The main manager class that handles:
- Shader initialization and copying from assets to internal storage
- Shader chain generation based on mode and quality settings
- Quality levels: FAST (S), BALANCED (M), HIGH (L)
- Modes: OFF, A, B, C, A_PLUS, B_PLUS, C_PLUS

**Key Methods:**
- `initialize()` - Copies shaders from assets to internal storage
- `getShaderChain(mode, quality)` - Returns GLSL shader chain string
- `Mode` enum - Defines different upscaling presets
- `Quality` enum - Defines quality/performance variants

### 2. Shader Modes

| Mode | Description | Shader Chain |
|------|-------------|--------------|
| A | Restore → Upscale ×2 | Clamp → Restore → Upscale → Downscale → Upscale |
| B | Restore Soft → Upscale ×2 | Clamp → Restore_Soft → Upscale → Downscale → Upscale |
| C | Denoise + Upscale ×2 | Clamp → Upscale_Denoise → Downscale → Upscale |
| A+ | Enhanced A | Clamp → Restore → Upscale → Downscale → Restore → Upscale |
| B+ | Enhanced B | Clamp → Restore_Soft → Upscale → Downscale → Restore_Soft → Upscale |
| C+ | Hybrid | Clamp → Upscale_Denoise → Downscale → Restore → Upscale |

### 3. Quality Levels

| Quality | Suffix | Performance | Use Case |
|---------|--------|-------------|----------|
| FAST | S | Lowest overhead | Mobile/low-end devices |
| BALANCED | M | Medium quality | General use |
| HIGH | L | Best quality | High-end devices |

### 4. Shader Files (14 total)

**Core shaders:**
- `Anime4K_Clamp_Highlights.glsl` - Prevents ringing artifacts (always included)
- `Anime4K_AutoDownscalePre_x2.glsl` - Downscales before second upscaling pass

**Restore shaders (3 quality levels each):**
- `Anime4K_Restore_CNN_{S,M,L}.glsl` - Restoration filter
- `Anime4K_Restore_CNN_Soft_{S,M,L}.glsl` - Soft restoration filter

**Upscale shaders (3 quality levels each):**
- `Anime4K_Upscale_CNN_x2_{S,M,L}.glsl` - 2× upscaling
- `Anime4K_Upscale_Denoise_CNN_x2_{S,M,L}.glsl` - Denoise + 2× upscaling

## Integration Points

### DecoderPreferences.kt
Anime4K preferences are stored in `DecoderPreferences`:
```kotlin
val enableAnime4K = preferenceStore.getBoolean("enable_anime4k", false)
val anime4kMode = preferenceStore.getString("anime4k_mode", "OFF")
val anime4kQuality = preferenceStore.getString("anime4k_quality", "FAST")
```

### MPVView.kt
Shader application happens in `applyAnime4KShaders()`:
- Called during `initOptions()` before file load
- Checks for GPU compatibility (avoids gpu-next on non-Vulkan)
- Initializes shaders via `anime4kManager.initialize()`
- Applies shader chain via `MPVLib.setOptionString("glsl-shaders", chain)`

### UI Components
- **DecoderPreferencesScreen.kt** - Settings toggle for enabling Anime4K
- **MoreSheet.kt** - In-player mode/quality selection chips

### DomainModule.kt
Dependency injection:
```kotlin
single { Anime4KManager(androidContext()) }
```

## String Resources

All Anime4K-related strings are in `res/values/strings_anime4k.xml`:
- Mode labels: Off, A, B, C, A+, B+, C+
- Quality labels: Fast, Balanced, High
- UI strings for settings and toasts

## Technical Notes

### GPU Compatibility
- **gpu-next**: Incompatible with Anime4K unless using Vulkan
- **Vulkan**: Enables gpu-next + Anime4K compatibility (Android 13+)
- **OpenGL**: Uses legacy gpu backend with `opengl-pbo=yes`

### Shader Loading
1. Shaders are copied from `assets/shaders/` to internal storage on first use
2. Shader chain is generated based on mode/quality selection
3. Chain is applied via mpv's `glsl-shaders` option
4. Runtime changes use `setPropertyString` for hot-swapping

### 4K+ Video Detection
Anime4K is automatically disabled for 4K/8K content (resolution ≥ 3840×2160) as upscaling provides no benefit.

## Usage Example

```kotlin
// Initialize
val manager = Anime4KManager(context)
manager.initialize()

// Get shader chain
val chain = manager.getShaderChain(
    mode = Anime4KManager.Mode.A_PLUS,
    quality = Anime4KManager.Quality.BALANCED
)

// Apply to mpv
MPVLib.setOptionString("glsl-shaders", chain)
```

## License

Anime4K shaders are licensed under MIT License:
Copyright (c) 2019-2021 bloc97

See individual shader files for full license headers.
