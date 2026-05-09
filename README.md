# 📺 AniMira TV WebView

Android TV приложение WebView для просмотра аниме с сайта AniMira.

## 🏗️ Архитектура

Проект состоит из трёх частей:

- **Web** (`web/`) — React + Vite фронтенд с TV-оптимизацией
- **Android** (`android-tv-webview/`) — WebView-приложение для Android TV
- **Server** (`app/`) — Python FastAPI сервер (опционально, для автообновлений)

## 🌐 Деплой на Render.com

**Новый способ:** Полный деплой на бесплатном хостинге Render.com

- 📖 [Быстрый старт](./RENDER_README.md) — 5 минут до продакшена
- 📚 [Полная инструкция](./DEPLOY.md) — подробное руководство
- � [GitHub Setup](./GITHUB_SETUP.md) — создание private repo

---

## �🚀 Быстрый старт (Локально)

### 1. Настройка сервера

```bash
# Установка зависимостей
pip install fastapi uvicorn httpx

# Запуск
python run.py
# или
cd app && uvicorn main:app --host 0.0.0.0 --port 8000
```

Сервер будет доступен на `http://192.168.2.7:8000`

### 2. Запуск Web

```bash
cd web
npm install
npm run dev -- --host
```

Web сервер будет на `http://192.168.2.7:5173`

### 3. Сборка Android

```bash
cd android-tv-webview
.\gradlew.bat assembleDebug
```

APK будет в `app/build/outputs/apk/debug/app-debug.apk`

### 4. Установка на TV

```bash
adb connect <IP_ТВ>
adb install app\build\outputs\apk\debug\app-debug.apk
```

## 🔄 Автообновление APK

Приложение автоматически проверяет наличие обновлений при запуске.

### Настройка автообновления:

1. **Версия в Android** — `android-tv-webview/app/build.gradle.kts`:
   ```kotlin
   versionCode = 2
   versionName = "1.1"
   ```

2. **Версия на сервере** — `app/main.py`:
   ```python
   APK_VERSION = {
       "version_code": 2,        # Должен совпадать!
       "version_name": "1.1",    # Должен совпадать!
       "changelog": "Описание"
   }
   ```

3. **Путь к APK** — `app/main.py`:
   ```python
   APK_PATH = Path("android-tv-webview/app/build/outputs/apk/debug/app-debug.apk")
   ```

### Ручная проверка обновлений:

В настройках приложения (кнопка Меню на пульте → Настройки → Проверить обновления)

## 🎯 TV-навигация

Приложение оптимизировано для управления с пульта D-pad:

- ⬆️⬇️⬅️➡️ — перемещение фокуса
- ⭕ OK/Enter — выбор
- ⬅️ Back — назад
- ☰ Menu — настройки

Все интерактивные элементы имеют `tv-focusable` класс и видимый фокус.

## 📱 Управление

### Настройки (кнопка Меню на пульте)

- **URL сайта** — адрес web сервера (по умолчанию `https://animira.onrender.com`)
- **Проверить обновления** — ручная проверка версии APK

## 🛠️ Разработка

### Полезные команды

```bash
# Логи Android
adb logcat -s AniMiraTV:D AniMiraUpdater:D

# Отладка WebView
# Открой chrome://inspect на ПК

# Пересборка и переустановка
.\gradlew.bat assembleDebug && adb install -r app\build\outputs\apk\debug\app-debug.apk
```

### Структура проекта

```
android-tv-webview/
├── app/src/main/java/com/animira/tv/
│   ├── MainActivity.kt      # Главная активность с WebView
│   ├── Updater.kt           # Логика автообновления
│   ├── SettingsActivity.kt  # Экран настроек
│   └── SettingsManager.kt   # SharedPreferences
├── app/build.gradle.kts      # Версия и зависимости
└── app/src/main/res/xml/
    └── file_paths.xml       # Для установки APK

web/
├── src/
│   ├── hooks/
│   │   └── useTVNavigation.ts  # Навигация с пульта
│   ├── components/
│   │   ├── Navbar.tsx          # Верхняя панель
│   │   └── AnimeCard.tsx       # Карточка аниме
│   └── pages/
│       ├── Home.tsx            # Главная страница
│       └── AnimeDetail.tsx     # Страница аниме
└── src/index.css               # TV-стили

app/
└── main.py                     # API сервера + автообновление
```

## 📝 Заметки для AI

Для работы с проектом смотри `AGENTS.md` — там описаны:
- Процесс выпуска обновлений
- Критические ограничения
- Тестовые сценарии
- Полезные команды

## 🐛 Троблшутинг

### Приложение не видит сервер
- Проверь что сервер запущен и доступен по IP
- Проверь настройки URL в приложении (Меню → Настройки)
- Убедись что порт 8000 не блокируется файерволом

### Не работает скачивание торрентов
- Убедись что на TV установлено приложение для торрентов
- Проверь логи: `adb logcat -s AniMiraTV:D`

### Не работает автообновление
- Проверь что `versionCode` и `version_name` совпадают в `build.gradle.kts` и `main.py`
- Проверь путь к APK в `APK_PATH`
- Проверь endpoint: `curl https://animira.onrender.com/api/version`

### Не видно фокус на элементах
- Все интерактивные элементы должны иметь `tabIndex={0}` и класс `tv-focusable`
- Проверь стили в `web/src/index.css`

## 📄 Лицензия

MIT
