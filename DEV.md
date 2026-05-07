# 🛠️ Локальная разработка

## Быстрый старт

### Вариант 1: Через `start.bat` (Windows)

```bash
# Запускает и бэкенд, и фронтенд в отдельных окнах
start.bat
```

- **Backend**: http://localhost:8000/api/
- **Frontend**: http://localhost:5173
- **API docs**: http://localhost:8000/api/

### Вариант 2: Вручную (Windows/Mac/Linux)

**Терминал 1 — Backend:**
```bash
python run.py
```

**Терминал 2 — Frontend:**
```bash
cd web
npm install
npm run dev
```

### Вариант 3: Только Backend (для тестирования API)

```bash
python run.py
```

Проверьте API:
```bash
curl http://localhost:8000/api/
```

---

## 🔧 Как это работает

### Локальная разработка

```
┌─────────────────┐      ┌─────────────────┐
│  Frontend       │      │  Backend        │
│  (Vite dev)     │      │  (FastAPI)      │
│  localhost:5173 │─────▶│  localhost:8000 │
│                 │ /api │                 │
└─────────────────┘      └─────────────────┘
```

- Фронтенд на порту **5173** (Vite dev server)
- Бэкенд на порту **8000** (FastAPI)
- Vite проксирует `/api/*` запросы на бэкенд

### Production (Render.com)

```
┌─────────────────────────────────────┐
│         Render.com                  │
│  ┌─────────────────────────────┐    │
│  │  animira (Web Service)      │    │
│  │  https://animira.onrender.com   │
│  │                             │    │
│  │  ┌─────────────────────┐    │    │
│  │  │  /api/* → FastAPI   │    │    │
│  │  │  /* → index.html   │    │    │
│  │  └─────────────────────┘    │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

- Один сервис раздаёт и **API** и **фронтенд**
- API доступен по `/api/*`
- Фронтенд (SPA) на всех остальных путях

---

## 📝 API Endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /api/` | Health check |
| `GET /api/sources` | Список источников |
| `GET /api/anime/list?source=...` | Список аниме |
| `GET /api/anime/search?source=...&query=...` | Поиск |
| `GET /api/anime/details?source=...&url=...` | Детали аниме |
| `GET /api/anime/episodes?source=...&url=...` | Список серий |
| `GET /api/anime/video?source=...&episode_url=...` | Видео |
| `GET /api/proxy?url=...` | Прокси для видео |

---

## 🔄 Переключение между локальным и продакшен API

В `web/src/api/client.ts`:

```typescript
// По умолчанию — относительный путь (работает везде)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

Для принудительного использования продакшен API локально:

```bash
# Linux/Mac
VITE_API_URL=https://animira.onrender.com/api npm run dev

# Windows PowerShell
$env:VITE_API_URL="https://animira.onrender.com/api"; npm run dev
```

---

## 🧪 Тестирование перед деплоем

### 1. Сборка фронтенда (как на Render)

```bash
cd web
npm run build
```

### 2. Запуск в production-режиме

```bash
# FastAPI раздаст собранный фронтенд из web/dist
python run.py
```

Откройте http://localhost:8000 — должен работать полный функционал.

### 3. Проверка API

```bash
curl http://localhost:8000/api/
curl http://localhost:8000/api/sources
```

---

## 🐛 Отладка

### Логи бэкенда

В консоли где запущен `python run.py` — логи появляются автоматически.

### Логи фронтенда

В консоли где запущен `npm run dev` — ошибки сборки и запросы.

### Chrome DevTools для Android TV WebView

1. Откройте `chrome://inspect` в Chrome на ПК
2. Подключите Android TV по USB или ADB
3. WebView должен появиться в списке для отладки

---

## 📁 Структура для Render

```
animira/                    # Корень проекта
├── app/                    # FastAPI backend
│   ├── main.py            # Точка входа
│   └── ...
├── web/                    # React frontend
│   ├── src/               # Исходники
│   └── dist/              # Сборка (создаётся npm run build)
├── render.yaml            # Конфиг Render.com
└── requirements.txt       # Python зависимости
```

Render.com выполняет:
1. `pip install -r requirements.txt` — backend
2. `cd web && npm install && npm run build` — frontend
3. `uvicorn app.main:app` — запуск сервиса
