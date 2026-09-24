# Автозапуск и ежедневная резервная копия на Windows.
# Запуск:  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1
#
# Создаёт два задания в планировщике Windows:
#   TaskTracker         — поднимает систему при входе в Windows;
#   TaskTracker-Backup  — снимает копию базы и вложений каждый день в 3:00.
# Снять оба:  powershell -ExecutionPolicy Bypass -File scripts\autostart.ps1 -Remove

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

$npm = (Get-Command npm.cmd).Source

# Приложение: поднимается при входе в Windows и слушает адрес в сети.
$startAction = New-ScheduledTaskAction -Execute $npm -Argument "run start:lan" -WorkingDirectory $project
$atLogon = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "TaskTracker" -Action $startAction -Trigger $atLogon -Settings $settings -Force | Out-Null
Write-Host "Задание TaskTracker создано: система поднимается при входе в Windows."

# Резервная копия: каждый день в 3:00, хранятся последние 14.
$backupAction = New-ScheduledTaskAction -Execute $npm -Argument "run backup" -WorkingDirectory $project
$atNight = New-ScheduledTaskTrigger -Daily -At 3:00am
Register-ScheduledTask -TaskName "TaskTracker-Backup" -Action $backupAction -Trigger $atNight -Settings $settings -Force | Out-Null
Write-Host "Задание TaskTracker-Backup создано: копия каждый день в 3:00."

Write-Host ""
Write-Host "Куда складывать копии, задаёт строка BACKUP_DIR в файле .env."
Write-Host "По умолчанию это папка backups рядом с проектом — на том же диске,"
Write-Host "что и система, поэтому укажите облачный диск или внешний носитель:"
Write-Host '  BACKUP_DIR=C:\Users\Вы\OneDrive\TaskTracker-backups'
Write-Host ""
Write-Host "Проверить, что копия снимается:  npm run backup"
Write-Host "Список копий:                    npm run backup -- --list"
