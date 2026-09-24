# Автозапуск и ежедневная резервная копия на Windows.
# Запуск:  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1
#
# Создаёт два задания в планировщике Windows:
#   TaskTracker         — поднимает систему при входе в Windows;
#   TaskTracker-Backup  — снимает копию базы и вложений каждый день в 3:00.
# Снять оба:  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 -Remove
#
# Файл сохранён в UTF-8 с BOM: Windows PowerShell 5.1 без BOM читает его как
# cp1251, кириллица превращается в кракозябры, и скрипт падает на разборе.

param([switch]$Remove)

$ErrorActionPreference = "Stop"
$project = Split-Path $PSScriptRoot -Parent
Set-Location $project

if ($Remove) {
    foreach ($name in @("TaskTracker", "TaskTracker-Backup")) {
        if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $name -Confirm:$false
            Write-Host "Задание $name снято."
        }
    }
    Write-Host "Данные не тронуты: сняты только задания планировщика."
    exit 0
}

# Задания заводятся на текущего пользователя: триггер «при входе любого
# пользователя» требует прав администратора и без них не регистрируется.
$user = "$env:USERDOMAIN\$env:USERNAME"

# Запускаем не npm.cmd напрямую, а powershell со скрытым окном: иначе система
# работает в видимом окне консоли, и закрытое окно её останавливает.
$shell = (Get-Command powershell.exe).Source

function Command($npmScript) {
    return "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command " +
        "`"Set-Location '$project'; npm run $npmScript`""
}

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Приложение: поднимается при входе в Windows и слушает адрес в сети.
$startAction = New-ScheduledTaskAction -Execute $shell -Argument (Command "start:lan") -WorkingDirectory $project
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $user
Register-ScheduledTask -TaskName "TaskTracker" -Action $startAction -Trigger $atLogon -Settings $settings -User $user -Force | Out-Null
Write-Host "Задание TaskTracker создано: система поднимается при входе в Windows."

# Резервная копия: каждый день в 3:00, хранятся последние 14.
$backupAction = New-ScheduledTaskAction -Execute $shell -Argument (Command "backup") -WorkingDirectory $project
$atNight = New-ScheduledTaskTrigger -Daily -At 3:00am
Register-ScheduledTask -TaskName "TaskTracker-Backup" -Action $backupAction -Trigger $atNight -Settings $settings -User $user -Force | Out-Null
Write-Host "Задание TaskTracker-Backup создано: копия каждый день в 3:00."

Write-Host ""
Write-Host "Система работает без окна консоли. Остановить её можно так:"
Write-Host "  Диспетчер задач → вкладка «Подробности» → процесс node.exe → снять задачу"
Write-Host "или сняв задание:  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 -Remove"
Write-Host ""
Write-Host "Куда складывать копии, задаёт строка BACKUP_DIR в файле .env."
Write-Host "По умолчанию это папка backups рядом с проектом — на том же диске,"
Write-Host "что и система, поэтому укажите облачный диск или внешний носитель:"
Write-Host '  BACKUP_DIR=C:\Users\Вы\OneDrive\TaskTracker-backups'
Write-Host ""
Write-Host "Проверить, что копия снимается:  npm run backup"
Write-Host "Список копий:                    npm run backup -- --list"
