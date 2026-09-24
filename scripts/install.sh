#!/usr/bin/env bash
# Установка TaskTracker на macOS или Linux.
# Запуск из папки проекта:  bash scripts/install.sh
#
# Скрипт ничего не удаляет: уже существующий .env и уже созданную базу он
# оставляет как есть и только доводит установку до рабочего состояния.

set -euo pipefail
cd "$(dirname "$0")/.."

step() {
  printf '\n== %s\n' "$1"
}

step "Проверяю Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не установлен. Поставьте версию 22 или новее: https://nodejs.org" >&2
  exit 1
fi
version=$(node --version | sed 's/^v//')
if [ "${version%%.*}" -lt 22 ]; then
  echo "Нужен Node.js 22 или новее, сейчас $version. Обновите: https://nodejs.org" >&2
  exit 1
fi
echo "Node.js $version — подходит."

step "Ставлю зависимости"
npm ci

step "Готовлю настройки"
if [ -f .env ]; then
  echo "Файл .env уже есть, оставляю как есть."
else
  cp .env.example .env
  # Коллеги заходят по локальной сети по обычному http: с флагом Secure
  # браузер отбросил бы cookie входа, и войти было бы нельзя.
  printf '\nSESSION_COOKIE_SECURE=false\n' >> .env
  echo "Создан .env. Вход разрешён по http: система стоит во внутренней сети."
fi

step "Создаю базу"
npm run db:deploy

step "Собираю приложение"
npm run build

step "Завожу администратора"
echo "Сейчас скрипт спросит почту, ФИО и пароль. Под ними вы войдёте первым."
npm run auth:admin

address=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)

printf '\nГотово.\n'
echo "Запуск:             npm run start:lan"
echo "На этом компьютере: http://localhost:3000"
[ -n "${address:-}" ] && echo "Для коллег в сети:  http://${address}:3000"
printf '\nЧтобы система поднималась сама после перезагрузки:\n'
echo "  bash scripts/autostart.sh"
echo "Ежедневная резервная копия настраивается там же."
