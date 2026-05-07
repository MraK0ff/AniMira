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
# Убедитесь, что все изменения закоммичены
git add .
git commit -m "Подготовка к деплою на Render"

# Добавьте remote (замените YOUR_USERNAME на ваш ник)
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git

# Пуш на GitHub
git push -u origin main
```

---

## 🌐 Шаг 3: Деплой Backend API на Render

### Метод 1: Blueprint (Автоматический)

1. Войдите в [Render Dashboard](https://dashboard.render.com)
2. Нажмите **New +** → **Blueprint**
3. Выберите ваш GitHub репозиторий `AniMira`
4. Нажмите **Approve** для создания сервисов
5. Render автоматически создаст:
   - `animira` — Python FastAPI сервис
   - `animira-web` — Static site для фронтенда

### Метод 2: Ручной (Web Service)

1. Нажмите **New +** → **Web Service**
2. Выберите репозиторий `AniMira`
3. Настройки:
   - **Name**: `animira`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
4. Добавьте Environment Variable:
   - `BASE_URL` = `https://animira.onrender.com` (будет известен после деплоя)
5. Нажмите **Create Web Service**

---

## 🎨 Шаг 4: Деплой Frontend на Render

1. Нажмите **New +** → **Static Site**
2. Выберите репозиторий `AniMira`
3. Настройки:
   - **Name**: `animira-web`
   - **Build Command**: `cd web && npm install && npm run build`
   - **Publish Directory**: `web/dist`
   - **Plan**: Free
4. Нажмите **Create Static Site**

### Настройка переменных окружения для Frontend:

После создания API, обновите `BASE_URL` в настройках:

1. Перейдите в настройки `animira`
2. Скопируйте URL (например `https://animira.onrender.com`)
3. Добавьте в Environment Variables `animira`:
   - `BASE_URL` = ваш URL

---

## ⚙️ Шаг 5: Настройка CORS для Production

После деплоя обновите `BASE_URL` в настройках API:

```bash
# Проверьте работу API
curl https://animira.onrender.com/
```

---

## 🔧 Обновление приложения Android TV

После деплоя API, обновите URL в Android приложении:

**Файл:** `android-tv-webview/app/src/main/res/values/strings.xml`

```xml
<string name="default_web_url">https://animira-web.onrender.com</string>
<string name="default_api_url">https://animira.onrender.com</string>
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
- **Health Check**: Endpoint `/` возвращает статус API

---

## 🆘 Траблшутинг

### Сервис не стартует

1. Проверьте логи в Render Dashboard
2. Убедитесь что `requirements.txt` содержит все зависимости
3. Проверьте что `app/main.py` импортируется без ошибок

### Ошибка 404 на API

Убедитесь что `BASE_URL` настроен правильно и API доступен:

```bash
curl https://animira.onrender.com/api/version
```

### Frontend не подключается к API

Проверьте настройки CORS в `app/main.py` — `allow_origins` должен включать домен фронтенда.

### Build fails

Для фронтенда убедитесь что `web/package.json` содержит скрипт `build`.

---

## 📝 Полезные команды

```bash
# Проверка API локально
python run.py

# Проверка сборки фронтенда
cd web && npm run build

# Ручной деплой (если нужно)
git push origin main --force
```

---

## 🎯 Структура сервисов на Render

```
┌─────────────────────────────────────┐
│         Render.com                  │
│  ┌─────────────────────────────┐    │
│  │  animira-web (Static)       │    │
│  │  https://animira.onrender.com│   │
│  └──────────────┬──────────────┘    │
│                 │                   │
│                 ▼                   │
│  ┌─────────────────────────────┐    │
│  │  animira (Web Service)  │    │
│  │  https://animira.onrender.com│
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```
