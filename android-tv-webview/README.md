# Anistar TV - Android TV WebView

Android TV приложение для просмотра Anistar с поддержкой TorrServe.

## Функции

- WebView для отображения вашего сайта
- Поддержка TorrServe переходов (localhost:8090)
- Оптимизация для Android TV (D-pad навигация)
- Настройки URL сайта и TorrServe хоста

## Структура проекта

```
android-tv-webview/
├── app/
│   ├── src/main/
│   │   ├── java/com/anistar/tv/
│   │   │   ├── MainActivity.kt       # Главный экран с WebView
│   │   │   ├── SettingsActivity.kt   # Настройки приложения
││   │   └── SettingsManager.kt    # Управление настройками
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml     # Layout WebView
│   │   │   │   └── activity_settings.xml  # Layout настроек
│   │   │   ├── values/
│   │   │   │   ├── strings.xml
│   │   │   │   ├── colors.xml
│   │   │   │   └── themes.xml
│   │   │   └── drawable/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

## Сборка

### Требования
- Android Studio Hedgehog (2023.1.1) или новее
- JDK 17
- Android SDK 35

### Сборка APK

```bash
cd android-tv-webview
./gradlew assembleDebug
```

APK будет создан в `app/build/outputs/apk/debug/app-debug.apk`

### Сборка Release

```bash
./gradlew assembleRelease
```

## Установка на Android TV

### Способ 1: ADB
```bash
adb connect <TV_IP_ADDRESS>
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Способ 2: USB
1. Включите "Отладку по USB" в настройках TV
2. Подключите TV к компьютеру через USB
3. Установите APK через Android Studio или ADB

## Использование

### Управление
- **D-pad/Стрелки** - навигация по сайту
- **OK/Enter** - выбор элемента
- **Back** - назад
- **Menu** - открыть настройки

### TorrServe
При нажатии на ссылку `http://localhost:8090/stream?link=...` приложение:
1. Проверяет наличие установленного TorrServe
2. Открывает видео в TorrServe приложении
3. Если TorrServe не найден - предлагает скачать или скопировать ссылку

### Настройки
1. Нажмите кнопку **Menu** на пульте
2. Укажите URL вашего сайта (по умолчанию: `http://localhost:5173`)
3. Укажите хост TorrServe (по умолчанию: `localhost:8090`)

## Настройка сети

Если ваш сайт запущен на ПК, а TV подключен к той же сети:

1. Найдите IP вашего ПК: `ipconfig` (Windows) или `ip addr` (Linux)
2. В настройках TV приложения укажите: `http://<PC_IP>:5173`
3. Для TorrServe: `<PC_IP>:8090`

## Лицензия
MIT
