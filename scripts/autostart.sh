#!/usr/bin/env bash
# Автозапуск и ежедневная резервная копия на macOS.
# Запуск:  bash scripts/autostart.sh
#
# Создаёт две службы launchd в ~/Library/LaunchAgents:
#   ru.tasktracker.app     — поднимает систему при входе в систему;
#   ru.tasktracker.backup  — снимает копию базы и вложений каждый день в 3:00.
# Снять обе:  bash scripts/autostart.sh --remove

set -euo pipefail
cd "$(dirname "$0")/.."
project="$(pwd)"
agents="$HOME/Library/LaunchAgents"
npm_path="$(command -v npm)"

remove_all() {
  for label in ru.tasktracker.app ru.tasktracker.backup; do
    file="$agents/$label.plist"
    [ -f "$file" ] || continue
    launchctl unload "$file" 2>/dev/null || true
    rm "$file"
    echo "Служба $label снята."
  done
  echo "Данные не тронуты: сняты только службы автозапуска."
}

if [ "${1:-}" = "--remove" ]; then
  remove_all
  exit 0
fi

mkdir -p "$agents" "$project/var/log"

# Аргументы: метка службы, команда npm, расписание.
unit() {
  cat > "$agents/$1.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array>
    <string>$npm_path</string>
    <string>run</string>
    <string>$2</string>
  </array>
  <key>WorkingDirectory</key><string>$project</string>
  <key>StandardOutPath</key><string>$project/var/log/$1.log</string>
  <key>StandardErrorPath</key><string>$project/var/log/$1.log</string>
$3
</dict>
</plist>
PLIST
  launchctl unload "$agents/$1.plist" 2>/dev/null || true
  launchctl load "$agents/$1.plist"
}

unit ru.tasktracker.app start:lan '  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>'
echo "Служба ru.tasktracker.app создана: система поднимается при входе."

unit ru.tasktracker.backup backup '  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>'
echo "Служба ru.tasktracker.backup создана: копия каждый день в 3:00."

cat <<'ПОДСКАЗКА'

Куда складывать копии, задаёт строка BACKUP_DIR в файле .env.
По умолчанию это папка backups рядом с проектом — на том же диске, что и
система, поэтому укажите облачный диск или внешний носитель:
  BACKUP_DIR=/Users/вы/Library/CloudStorage/TaskTracker-backups

Проверить, что копия снимается:  npm run backup
Список копий:                    npm run backup -- --list
Журнал работы:                   var/log/ru.tasktracker.app.log
ПОДСКАЗКА
