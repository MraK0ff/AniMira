# 📦 Создание Private Repo на GitHub

## 🚀 Быстрый старт

### 1. Создание репозитория через веб

1. Перейдите на [github.com/new](https://github.com/new)
2. **Repository name**: `AniMira`
3. **Description**: `Anime streaming platform for Android TV with WebView`
4. Выберите **Private** 🔒
5. **Initialize this repository with:**
   - ☑️ Add a README
   - ☑️ Add .gitignore → выберите `Python`
   - ☐ Add a license (опционально)
6. Нажмите **Create repository**

---

### 2. Инициализация локального репозитория

Если проект еще не в Git:

```bash
# Перейдите в папку проекта
cd c:\Users\wajtb\PycharmProjects\AniMira

# Инициализация Git
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: AniMira project"

# Привязка к удаленному репозиторию (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git

# Пуш на GitHub
git push -u origin main
```

---

### 3. Если репозиторий уже существует на GitHub

```bash
# Привязка к существующему репо
git remote add origin https://github.com/YOUR_USERNAME/AniMira.git

# Проверка
git remote -v

# Пуш
git push -u origin main
```

---

## 🔐 Настройка SSH (рекомендуется)

### Генерация SSH ключа

```bash
# Генерация нового ключа
ssh-keygen -t ed25519 -C "your.email@example.com"

# Запуск SSH agent
ssh-add ~/.ssh/id_ed25519

# Копирование публичного ключа
cat ~/.ssh/id_ed25519.pub
```

### Добавление ключа на GitHub

1. Скопируйте вывод команды выше
2. GitHub → Settings → SSH and GPG keys
3. New SSH key
4. Вставьте ключ и сохраните

### Использование SSH URL

```bash
# Измените remote на SSH
git remote set-url origin git@github.com:YOUR_USERNAME/AniMira.git

# Теперь можно пушить без пароля
git push origin main
```

---

## 🔧 Рабочий процесс с Git

### Ежедневный workflow

```bash
# Получить последние изменения
git pull origin main

# Создать ветку для фичи
git checkout -b feature/new-feature

# Работа над кодом...

# Коммит изменений
git add .
git commit -m "Add: новая фича"

# Пуш ветки
git push origin feature/new-feature

# Создание Pull Request на GitHub
# (через веб-интерфейс)

# После мержа — возврат на main
git checkout main
git pull origin main
```

### Полезные команды

```bash
# Статус репозитория
git status

# История коммитов
git log --oneline -10

# Отмена изменений в файле
git checkout -- filename

# Создание тега для релиза
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0
```

---

## 🌿 Стратегия веток

```
main          ●────●────●────●────●────●
              │         │         │
feature/api   ●────●────┘         │
                                │
feature/ui              ●────●──┘
```

- `main` — стабильная ветка, деплоится на Render
- `feature/*` — ветки для новых функций
- `hotfix/*` — срочные исправления

---

## 📝 .gitignore проверка

Убедитесь, что в `.gitignore` есть:

```gitignore
# Python
__pycache__/
*.py[cod]
.venv/
.env

# Node
node_modules/
dist/
build/

# IDE
.idea/
.vscode/

# Project specific
repos/*.b
```

---

## 🚨 Важные замечания

### Репозиторий должен быть Private потому что:
- Конфигурации парсеров (`.json`) содержат специфичную логику
- Возможны API ключи или sensitive data
- Android TV приложение привязано к вашей инфраструктуре

### Не коммитьте:
- Локальные настройки (`.env.local`)
- Собранные APK файлы
- Логи и кэш
- Бинарные файлы парсеров (`*.b`)

---

## 🔗 Интеграция с Render

После создания репозитория:

1. Зайдите в [Render Dashboard](https://dashboard.render.com)
2. New + → Blueprint
3. Выберите `YOUR_USERNAME/AniMira`
4. Render автоматически прочитает `render.yaml`
5. Нажмите Approve

Готово! 🎉
