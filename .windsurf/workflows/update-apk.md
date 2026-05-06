---
description: How to release APK update
---

# 🚀 Релиз обновления APK

## Шаг 1: Подготовка

1. Убедись, что все изменения в Android коде готовы
2. Проверь `AGENTS.md` для критических ограничений

## Шаг 2: Обновление версии

### В файле `android-tv-webview/app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = <OLD + 1>      // Увеличить на 1
    versionName = "X.Y"        // Новая версия
}
```

## Шаг 3: Обновление сервера

### В файле `app/main.py`:

```python
APK_VERSION = {
    "version_code": <SAME_AS_BUILD>,  # Должен совпадать!
    "version_name": "<SAME_AS_BUILD>",
    "changelog": "Описание изменений"
}
```

// turbo
## Шаг 4: Сборка

```bash
cd android-tv-webview
.\gradlew.bat assembleDebug
```

## Шаг 5: Проверка

```bash
# Проверь что APK существует
ls app/build/outputs/apk/debug/app-debug.apk

# Проверь endpoint
curl http://192.168.2.7:8000/api/version
```

## Шаг 6: Тестирование

1. Установи старую версию на TV
2. Открой приложение
3. Должно появиться окно обновления
4. Нажми "Обновить" и проверь установку
