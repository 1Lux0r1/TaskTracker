# Установка TaskTracker на компьютере с Windows.
# Запуск из папки проекта:  powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#
# Скрипт ничего не удаляет: уже существующий .env и уже созданную базу он
# оставляет как есть и только доводит установку до рабочего состояния.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($text) {
    Write-Host ""
    Write-Host "== $text" -ForegroundColor Cyan
}

Step "Проверяю Node.js"
try {
    $version = (node --version).TrimStart("v")
} catch {
    Write-Host "Node.js не установлен. Поставьте версию 22 или новее: https://nodejs.org" -ForegroundColor Red
    exit 1
}
if ([int]($version.Split(".")[0]) -lt 22) {
    Write-Host "Нужен Node.js 22 или новее, сейчас $version. Обновите: https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $version — подходит."

Step "Ставлю зависимости"
npm ci

Step "Готовлю настройки"
if (Test-Path ".env") {
    Write-Host "Файл .env уже есть, оставляю как есть."
} else {
    Copy-Item ".env.example" ".env"
    # Коллеги заходят по локальной сети по обычному http: с флагом Secure
    # браузер отбросил бы cookie входа, и войти было бы нельзя.
    Add-Content ".env" "`r`nSESSION_COOKIE_SECURE=false"
    Write-Host "Создан .env. Вход разрешён по http: система стоит во внутренней сети."
}

Step "Создаю базу"
npm run db:deploy

Step "Собираю приложение"
npm run build

Step "Завожу администратора"
Write-Host "Сейчас скрипт спросит почту, ФИО и пароль. Под ними вы войдёте первым."
npm run auth:admin

$address = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Готово." -ForegroundColor Green
Write-Host "Запуск:            npm run start:lan"
Write-Host "На этом компьютере: http://localhost:3000"
if ($address) { Write-Host "Для коллег в сети:  http://${address}:3000" }
Write-Host ""
Write-Host "Чтобы система поднималась сама после перезагрузки:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1"
Write-Host "Ежедневная резервная копия настраивается там же."
