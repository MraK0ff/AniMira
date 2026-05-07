# 🚀 Деплой AniMira на Render.com

## 📋 Предварительные требования

1. Аккаунт на [Render.com](https://render.com) (бесплатный tier доступен)
2. GitHub аккаунт с приватным репозиторием
3. Установленный Git

---

## 🔄 Шаг 1: Создание приватного репозитория на GitHub

### Вариант 1: Через веб-интерфейс

1. Зайдите на [github.com/new](https://github.com/new)
2. Введите имя репозитория: `AniMira`
3. Выберите **Private** (приватный)
4. Нажмите **Create repository**

### Вариант 2: Через Git CLI

```bash
# Создайте репозиторий на GitHub через API
gh repo create AniMira --private --source=. --push
```

---

## 📤 Шаг 2: Пуш проекта на GitHub

```bash
# Убедитесь что все изменения закоммичены
git add .
git commit -m "Подготовка к деплою на Render"

# Добавьте remote (замените YOUR_USERNAME на ваш ник)
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git

# Пуш на GitHub
git push -u origin main
```

---

## 🌐 Шаг 3: Деплой на Render (Blueprint)

**Blueprint** — автоматическая конфигурация через `render.yaml`.

1. Войдите в [Render Dashboard](https://dashboard.render.com)
2. Нажмите **New +** → **Blueprint**
3. Выберите ваш GitHub репозиторий `AniMira`
4. Нажмите **Approve** для создания сервиса

Render автоматически создаст сервис `animira` который включает:
- **Backend**: FastAPI на `/api/*`
- **Frontend**: React SPA на всех остальных путях

**URL**: `https://animira.onrender.com`

---

## 🔧 Обновление приложения Android TV

После деплоя обновите URL в Android приложении:

**Файл:** `android-tv-webview/app/src/main/res/values/strings.xml`

```xml
<string name="default_web_url">https://animira.onrender.com</string>
<string name="default_api_url">https://animira.onrender.com/api</string>
```

Или в коде `SettingsManager.kt` обновите `DEFAULT_URL`.

---

## 🔄 Автоматический деплой

Render автоматически деплоит изменения при пуше в `main` ветку:

```bash
git add .
git commit -m "Обновление функционала"
git push origin main
```

Через 2-3 минуты изменения будут на продакшене.

---

## 📊 Мониторинг

- **Logs**: В dashboard Render → ваш сервис → Logs
- **Metrics**: Доступны на платных планах
- **Health Check**: Endpoint `/api/` возвращает статус API

---

## 🆘 Траблшутинг

### Сервис не стартует

1. Проверьте логи в Render Dashboard
2. Убедитесь что `requirements.txt` содержит все зависимости
3. Проверьте что `app/main.py` импортируется без ошибок

### Ошибка 404 на API

```bash
# Проверьте что API доступен
curl https://animira.onrender.com/api/
curl https://animira.onrender.com/api/version
```

### Frontend показывает белый экран

1. Проверьте что `web/dist` создался при сборке
2. В логах Render найдите ошибки сборки фронтенда
3. Убедитесь что `npm run build` выполняется без ошибок

### Build fails

Для фронтенда убедитесь что `web/package.json` содержит скрипт `build`.

---

## 📝 Полезные команды

```bash
# Локальная разработка
python run.py              # Backend
cd web && npm run dev    # Frontend

# Справка по локальному запуску
# См. DEV.md
```

---

## 🎯 Структура сервиса на Render

```
┌─────────────────────────────────────┐
│         animira.onrender.com        │
│         (Один Web Service)          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  /api/* → FastAPI           │    │
│  │  /api/sources               │    │
│  │  /api/anime/list            │    │
│  │  /api/proxy                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  /* → React SPA              │    │
│  │  / → index.html               │    │
│  │  /anime/123 → index.html      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Преимущества одного сервиса:**
- Нет проблем с CORS (один origin)
- Один URL для всего
- Проще деплой и настройка
