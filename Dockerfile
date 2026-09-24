# Образ для облака. На пилоте система ставится скриптом прямо на компьютер;
# Docker нужен на втором шаге, когда переезжаем на сервер.
#
# Сборка в два слоя: сначала зависимости и сборка, потом лёгкий образ с тем,
# что нужно для работы. База и вложения живут в томах, а не в образе, иначе
# обновление образа стирало бы данные.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 собирается из исходников, поэтому на этом слое нужен компилятор.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/tasktracker.db
ENV ATTACHMENTS_DIR=/data/attachments
ENV BACKUP_DIR=/backups

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=build /app/scripts ./scripts

VOLUME ["/data", "/backups"]
EXPOSE 3000

# Миграции применяются при старте: обновление образа не требует отдельного шага.
CMD ["sh", "-c", "npm run db:deploy && npm run start:lan"]
