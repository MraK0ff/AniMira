# 🤖 Agent Instructions — AniMira TV WebView

> Этот файл содержит критически важную информацию для AI ассистентов, работающих с проектом.
> **ВСЕГДА** проверяй этот файл перед изменениями в Android или Web частях.

## 📁 Структура проекта

```
astar/
├── web/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/     # UI компоненты
│   │   ├── hooks/          # TV навигация и др.
│   │   ├── pages/          # Страницы (Home, AnimeDetail, etc.)
│   │   └── store/          # Zustand store
│   └── package.json
├── android-tv-webview/     # Android TV приложение
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/animira/tv/   # Kotlin код
│   │   │   └── res/                   # Layouts, strings, etc.
│   │   └── build.gradle.kts           # ВЕРСИЯ APK
│   └── gradle/
└── app/                    # Python FastAPI сервер
    └── main.py             # ENDPOINT для обновлений
```

---

## 🔄 Процесс выпуска обновления APK

### 1. Изменение версии (ОБЯЗАТЕЛЬНО)

**Файл:** `android-tv-webview/app/build.gradle.kts`

```kotlin
defaultConfig {
    versionCode = 3      // УВЕЛИЧИТЬ на 1
    versionName = "1.2"  // Изменить версию
}
```

### 2. Обновление серверной части

**Файл:** `app/main.py`

```python
APK_VERSION = {
    "version_code": 3,        # ДОЛЖЕН совпадать с build.gradle.kts
    "version_name": "1.2",    # ДОЛЖЕН совпадать с build.gradle.kts
    "changelog": "Описание изменений"
}
```

### 3. Сборка APK

```bash
cd android-tv-webview
.\gradlew.bat assembleDebug
```

### 4. Проверка местоположения APK

APK должен быть по пути:
```
android-tv-webview/app/build/outputs/apk/debug/app-debug.apk
```

**ВАЖНО:** Если APK не найден по этому пути, endpoint `/api/download/apk` вернет 404.

### 5. Тестирование обновления

1. Запустить сервер: `python run.py` или `python -m app.main`
2. Проверить: `curl http://192.168.2.7:8000/api/version`
3. Установить старую версию APK на TV
4. Убедиться, что при запуске предлагает обновиться

---

## 🛠️ Частые операции

### Добавить TV-навигацию к новому элементу

```tsx
// Добавить tabIndex и tv-focusable
<button
  tabIndex={0}
  className="tv-focusable ..."
>
```

### Изменить URL сервера по умолчанию

**Android:** `android-tv-webview/app/src/main/res/values/strings.xml`
**Или в коде:** `SettingsManager.kt` — `DEFAULT_URL`

### Добавить новый endpoint для Android

**Сервер:** `app/main.py` — добавить `@app.get(...)`
**Android:** Добавить вызов в `Updater.kt` или `MainActivity.kt`

---

## ⚠️ Критические ограничения

### WebView и ссылки
- Все внешние ссылки должны обрабатываться через `handleUrl()` в `MainActivity.kt`
- Для скачивания используется `DownloadListener`
- Для torrent файлов есть специальная обработка в `handleTorrentDownload()`

### TV Навигация
- НЕ использовать `motion.div` с `whileHover` для карточек — это ломает фокус
- Использовать `focus:scale-105` CSS вместо Framer Motion hover
- Все кликабельные элементы должны иметь `tabIndex={0}` и `tv-focusable`

### Версионирование
- `versionCode` — целое число, должно увеличиваться
- `versionName` — строка, для отображения пользователю
- НЕ забывать обновлять `APK_VERSION` в `main.py` ПОСЛЕ изменения `build.gradle.kts`

---

## 🧪 Тестовые сценарии

### Проверка автообновления
1. Собрать APK с versionCode=1, установить
2. Изменить versionCode=2, собрать новый APK
3. Обновить `APK_VERSION` в `main.py`
4. Перезапустить сервер
5. Открыть приложение на TV — должно появиться окно обновления

### Проверка TV навигации
1. Открыть Home
2. Нажать стрелки на пульте
3. Фокус должен перемещаться между элементами
4. Фокусированный элемент должен иметь фиолетовую рамку

### Проверка скачивания торрентов
1. Открыть страницу аниме с торрентами
2. Нажать "Скачать 1080p"
3. На Android TV должно открыться приложение для скачивания

---

## 📚 Полезные команды

```bash
# Сборка Android
.\gradlew.bat assembleDebug

# Установка на TV
adb connect <TV_IP>
adb install app\build\outputs\apk\debug\app-debug.apk

# Логи Android
adb logcat -s AniMiraTV:D AniMiraUpdater:D

# Запуск сервера
python run.py
# или
cd app && uvicorn main:app --host 0.0.0.0 --port 8000

# Запуск web dev сервера
cd web
npm run dev -- --host
```

---

## 🔗 Ключевые файлы для редактирования

| Задача | Файл |
|--------|------|
| Версия APK | `android-tv-webview/app/build.gradle.kts` |
| Версия сервера | `app/main.py` (`APK_VERSION`) |
| TV Навигация | `web/src/hooks/useTVNavigation.ts` |
| Обработка ссылок | `android-tv-webview/app/src/main/java/com/animira/tv/MainActivity.kt` |
| Обновления APK | `android-tv-webview/app/src/main/java/com/animira/tv/Updater.kt` |
| Стили TV | `web/src/index.css` (`.tv-focusable`) |
| API Endpoints | `app/main.py` |

---

## 🚨 НЕ делай этого

1. **НЕ** добавляй `target="_blank"` на ссылки торрентов без обработки в Android
2. **НЕ** используй дефолтные браузерные диалоги — они не работают на TV
3. **НЕ** забывай добавлять `tv-focusable` к новым кнопкам
4. **НЕ** меняй путь к APK без обновления `APK_PATH` в `main.py`
5. **НЕ** используй `localhost` в URL для TV — используй IP компьютера

---

## 💡 Советы

- Всегда проверяй `adb logcat` при проблемах на Android
- Используй `chrome://inspect` для отладки WebView
- Проверяй `/api/version` перед тестированием обновлений
- Для TV используй `focus:` CSS классы вместо `hover:`
