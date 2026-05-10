# Anime4K File Structure

## Complete list of files related to Anime4K in mpvEx

### Shaders (14 GLSL files)
Located in: `app/src/main/assets/shaders/`

| # | File | Description | Size |
|---|------|-------------|------|
| 1 | Anime4K_Clamp_Highlights.glsl | Prevents ringing artifacts | ~90 lines |
| 2 | Anime4K_AutoDownscalePre_x2.glsl | Downscales before second upscaling | ~40 lines |
| 3 | Anime4K_Restore_CNN_S.glsl | Restoration filter (Fast) | ~350 lines |
| 4 | Anime4K_Restore_CNN_M.glsl | Restoration filter (Balanced) | ~650 lines |
| 5 | Anime4K_Restore_CNN_L.glsl | Restoration filter (High) | ~1300 lines |
| 6 | Anime4K_Restore_CNN_Soft_S.glsl | Soft restoration (Fast) | ~350 lines |
| 7 | Anime4K_Restore_CNN_Soft_M.glsl | Soft restoration (Balanced) | ~650 lines |
| 8 | Anime4K_Restore_CNN_Soft_L.glsl | Soft restoration (High) | ~1300 lines |
| 9 | Anime4K_Upscale_CNN_x2_S.glsl | 2× upscaling (Fast) | ~450 lines |
| 10 | Anime4K_Upscale_CNN_x2_M.glsl | 2× upscaling (Balanced) | ~900 lines |
| 11 | Anime4K_Upscale_CNN_x2_L.glsl | 2× upscaling (High) | ~1800 lines |
| 12 | Anime4K_Upscale_Denoise_CNN_x2_S.glsl | Denoise + upscale (Fast) | ~550 lines |
| 13 | Anime4K_Upscale_Denoise_CNN_x2_M.glsl | Denoise + upscale (Balanced) | ~1100 lines |
| 14 | Anime4K_Upscale_Denoise_CNN_x2_L.glsl | Denoise + upscale (High) | ~2200 lines |

**Total:** ~10,800 lines of GLSL shader code

### Kotlin Source Files

#### Core Domain
| File | Original Path | Lines | Description |
|------|---------------|-------|-------------|
| Anime4KManager.kt | `domain/anime4k/` | 186 | Shader management, chain generation |

#### Preferences
| File | Original Path | Lines | Description |
|------|---------------|-------|-------------|
| DecoderPreferences.kt | `preferences/` | 34 | Anime4K preference keys |

#### Dependency Injection
| File | Original Path | Lines | Description |
|------|---------------|-------|-------------|
| DomainModule.kt | `di/` | 21 | Anime4KManager singleton |

#### UI Components
| File | Original Path | Lines | Description |
|------|---------------|-------|-------------|
| MoreSheet.kt | `ui/player/controls/components/sheets/` | 416 | In-player Anime4K controls |
| DecoderPreferencesScreen.kt | `ui/preferences/` | 355 | Settings toggle |
| MPVView.kt | `ui/player/` | 384 | Shader application |

### String Resources
Located in: `app/src/main/res/values/strings.xml`

| Lines | Strings | Description |
|-------|---------|-------------|
| 232-237 | 6 | Feature strings |
| 238-253 | 16 | Anime4K mode/quality strings |

### References in other files:
- `PlayerActivity.kt` - Activity that hosts player
- `AmbientModeManager.kt` - Reacts to shader changes
- `PlayerSheets.kt` - Sheet wrapper
- `SearchablePreference.kt` - Settings search

## External Dependencies

- **Original Project:** https://github.com/bloc97/Anime4K
- **License:** MIT License
- **Copyright:** bloc97 (2019-2021)
- **Version:** v4.0 (based on shader headers)

## Integration Summary

```
Settings (DecoderPreferencesScreen.kt)
    ↓ enable_anime4k boolean
    
Koin DI (DomainModule.kt)
    ↓ injects Anime4KManager
    
MPVView (MPVView.kt)
    ↓ initOptions() calls applyAnime4KShaders()
    ↓ Copies shaders, generates chain, sets glsl-shaders
    
Player UI (MoreSheet.kt)
    ↓ Runtime mode/quality changes via FilterChips
    ↓ Calls MPVLib.setPropertyString("glsl-shaders", chain)
```

## Shader Chain Examples

### Mode A + Quality Balanced (M):
```
Anime4K_Clamp_Highlights.glsl:
Anime4K_Restore_CNN_M.glsl:
Anime4K_Upscale_CNN_x2_M.glsl:
Anime4K_AutoDownscalePre_x2.glsl:
Anime4K_Upscale_CNN_x2_M.glsl
```

### Mode C+ + Quality High (L):
```
Anime4K_Clamp_Highlights.glsl:
Anime4K_Upscale_Denoise_CNN_x2_L.glsl:
Anime4K_AutoDownscalePre_x2.glsl:
Anime4K_Restore_CNN_L.glsl:
Anime4K_Upscale_CNN_x2_L.glsl
```

## Preference Keys

```
enable_anime4k      → boolean (default: false)
anime4k_mode        → string (default: "OFF")
anime4k_quality     → string (default: "FAST")
```

## Mode Values
```kotlin
OFF, A, B, C, A_PLUS, B_PLUS, C_PLUS
```

## Quality Values
```kotlin
FAST ("S"), BALANCED ("M"), HIGH ("L")
```
