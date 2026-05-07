# PowerShell script для настройки GitHub репозитория
# Запуск: .\scripts\setup-github.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [Parameter(Mandatory=$false)]
    [string]$RepoName = "AniMira"
)

Write-Host "🚀 Настройка GitHub репозитория..." -ForegroundColor Cyan
Write-Host ""

# Проверка git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git не найден. Установите Git: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# Проверка gh CLI
$ghExists = Get-Command gh -ErrorAction SilentlyContinue
if (!$ghExists) {
    Write-Host "⚠️ GitHub CLI (gh) не найден. Рекомендуется установить:" -ForegroundColor Yellow
    Write-Host "   winget install --id GitHub.cli" -ForegroundColor Gray
    Write-Host ""
}

# Текущая директория должна быть корнем проекта
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "📁 Проект: $projectRoot" -ForegroundColor Gray
Write-Host "🔗 Репозиторий: https://github.com/$Username/$RepoName" -ForegroundColor Gray
Write-Host ""

# Инициализация git если нужно
if (!(Test-Path ".git")) {
    Write-Host "🔧 Инициализация Git..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit: AniMira project setup"
} else {
    Write-Host "✅ Git уже инициализирован" -ForegroundColor Green
}

# Проверка remote
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔗 Добавление remote origin..." -ForegroundColor Yellow
    git remote add origin "https://github.com/$Username/$RepoName.git"
} else {
    Write-Host "📝 Текущий remote: $remote" -ForegroundColor Gray
    $update = Read-Host "Обновить remote? (y/n)"
    if ($update -eq "y") {
        git remote set-url origin "https://github.com/$Username/$RepoName.git"
        Write-Host "✅ Remote обновлен" -ForegroundColor Green
    }
}

# Пуш
Write-Host ""
Write-Host "📤 Отправка на GitHub..." -ForegroundColor Yellow
$branch = git branch --show-current
git push -u origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Успешно отправлено на GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 URL: https://github.com/$Username/$RepoName" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Следующие шаги:" -ForegroundColor Yellow
    Write-Host "   1. Перейдите на https://dashboard.render.com" -ForegroundColor White
    Write-Host "   2. New + → Blueprint" -ForegroundColor White
    Write-Host "   3. Выберите $Username/$RepoName" -ForegroundColor White
    Write-Host "   4. Нажмите Approve" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Ошибка при отправке. Возможные причины:" -ForegroundColor Red
    Write-Host "   - Репозиторий еще не создан на GitHub" -ForegroundColor White
    Write-Host "   - Нет прав доступа" -ForegroundColor White
    Write-Host "   - Нужна аутентификация" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Создайте репозиторий вручную:" -ForegroundColor Yellow
    Write-Host "   https://github.com/new" -ForegroundColor Cyan
}
