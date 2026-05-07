# 🚀 AniMira на Render.com

Быстрая настройка деплоя на Render.com.

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
2. Выберите ваш репозиторий
3. Нажмите **Approve**

## 📁 Что деплоится

| Сервис | Тип | URL |
|--------|-----|-----|
| `animira` | Web Service | `https://animira.onrender.com` |
| `animira-web` | Static Site | `https://animira.onrender.com` |

## 🔧 Настройка Android TV

Обновите URL в приложении:

```kotlin
// SettingsManager.kt или strings.xml
DEFAULT_URL = "https://animira.onrender.com"
```

## 📚 Подробная документация

- [Полная инструкция деплоя](./DEPLOY.md)
- [Настройка GitHub](./GITHUB_SETUP.md)

---

**Бесплатный план:** API может "засыпать" после 15 мин без запросов. Первый запрос может занять 30-60 сек.
