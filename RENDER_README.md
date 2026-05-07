# 🚀 AniMira на Render.com

Быстрая настройка деплоя на Render.com. Всё в одном сервисе: API + Frontend.

## ⚡ Quick Deploy

### 1. GitHub Repo (Private)

```bash
# Создайте приватный репозиторий на GitHub
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git
git push -u origin main
```

### 2. Deploy на Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/AniMira)

Или вручную:

1. [Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**
2. Выберите ваш репозиторий `AniMira`
3. Нажмите **Approve**

## 📁 Что деплоится

| Сервис | Тип | URL | Описание |
|--------|-----|-----|----------|
| `animira` | Web Service | `https://animira.onrender.com` | API + Frontend в одном сервисе |

## 🔧 Настройка Android TV

Обновите URL в приложении:

```kotlin
// SettingsManager.kt или strings.xml
DEFAULT_URL = "https://animira.onrender.com"
```

## 📚 Полезные ссылки

- [Локальная разработка](./DEV.md) — как запускать локально
- [Полная инструкция деплоя](./DEPLOY.md)
- [Настройка GitHub](./GITHUB_SETUP.md)

---

**Бесплатный план:** Сервис может "засыпать" после 15 мин без запросов. Первый запрос может занять 30-60 сек.
