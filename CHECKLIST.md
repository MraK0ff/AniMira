# ✅ Чеклист деплоя AniMira на Render

## 📋 Подготовка

- [ ] Создать аккаунт на [render.com](https://render.com)
- [ ] Создать аккаунт на [github.com](https://github.com)
- [ ] Установить Git: `git --version`

---

## 🔐 Шаг 1: GitHub Private Repo

### Через веб-интерфейс:
- [ ] Открыть [github.com/new](https://github.com/new)
- [ ] Имя: `AniMira`
- [ ] Выбрать **Private** 🔒
- [ ] Создать репозиторий

### Или через PowerShell скрипт:
```powershell
.\scripts\setup-github.ps1 -Username "YOUR_GITHUB_USERNAME"
```

---

## 📤 Шаг 2: Пуш кода

```bash
# Если не использовали скрипт
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git
git push -u origin main
```

- [ ] Код отправлен на GitHub
- [ ] Видно все файлы: `render.yaml`, `requirements.txt`, `web/`, `app/`

---

## 🌐 Шаг 3: Деплой на Render

### Вариант A: Blueprint (рекомендуется)
- [ ] Открыть [dashboard.render.com](https://dashboard.render.com)
- [ ] **New +** → **Blueprint**
- [ ] Выбрать `AniMira` репозиторий
- [ ] Нажать **Approve**

### Вариант B: Вручную
- [ ] **New +** → **Web Service**
- [ ] Настройки:
  - Name: `animira`
  - Runtime: Python 3
  - Build: `pip install -r requirements.txt`
  - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Создать **Static Site**:
  - Name: `animira-web`
  - Build: `cd web && npm install && npm run build`
  - Publish: `web/dist`

---

## 🔧 Шаг 4: Настройка переменных окружения

После первого деплоя API:
- [ ] Скопировать URL API (например `https://animira.onrender.com`)
- [ ] Открыть настройки `animira` на Render
- [ ] Добавить Environment Variable:
  - `BASE_URL` = `https://animira.onrender.com`
- [ ] Перезапустить сервис (Manual Deploy → Deploy latest commit)

---

## 📱 Шаг 5: Обновление Android TV приложения

**Файл:** `android-tv-webview/app/src/main/res/values/strings.xml`

```xml
<string name="default_web_url">https://animira-web.onrender.com</string>
<string name="default_api_url">https://animira.onrender.com</string>
```

Или в `SettingsManager.kt`:
```kotlin
val DEFAULT_URL = "https://animira-web.onrender.com"
```

- [ ] URL обновлен в коде
- [ ] Пересобран APK: `.\gradlew.bat assembleDebug`
- [ ] Установлен на TV

---

## 🧪 Шаг 6: Тестирование

### API тест:
```bash
curl https://animira.onrender.com/
```
- [ ] Возвращает JSON с информацией об API

### Web тест:
- [ ] Открыть `https://animira-web.onrender.com` в браузере
- [ ] Проверить загрузку приложения

### TV тест:
- [ ] Открыть приложение на Android TV
- [ ] Проверить загрузку контента
- [ ] Проверить навигацию пультом

---

## 🔄 Шаг 7: Автоматический деплой

Проверка авто-деплоя:
```bash
# Локальное изменение
git add .
git commit -m "Test auto-deploy"
git push origin main
```

- [ ] Изменение появилось на Render через 2-3 минуты
- [ ] API работает с новой версией

---

## 🆘 Траблшутинг

### Сервис "спит" (cold start)
- Это нормально для Free tier
- Первый запрос может занять 30-60 сек
- Сервис "просыпается" от запросов

### 404 ошибки
```bash
# Проверить API
curl https://animira.onrender.com/api/version

# Проверить логи в Render Dashboard
```

### Build ошибки
- Проверить `render.yaml` синтаксис
- Проверить что `requirements.txt` содержит все зависимости
- Проверить что `web/package.json` есть скрипт `build`

---

## 🎉 Готово!

Когда все галочки отмечены — ваше приложение работает в облаке! 🚀

---

## 📚 Полезные ссылки

- [Render Dashboard](https://dashboard.render.com)
- [GitHub Repo](https://github.com/YOUR_USERNAME/AniMira)
- [DEPLOY.md](./DEPLOY.md) — полная инструкция
- [GITHUB_SETUP.md](./GITHUB_SETUP.md) — настройка GitHub
