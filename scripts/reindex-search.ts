/**
 * Пересобирает поисковые строки задач, писем, документов и встреч.
 *
 * SQLite не приводит кириллицу к нижнему регистру, поэтому строку готовит
 * приложение, а не база: после миграции, переноса данных или правки правил
 * поиска индекс надо пересобрать этой командой.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { buildSearchIndex } from "../src/lib/search";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main(): Promise<void> {
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      progressNote: true,
      externalTaskKey: true,
      externalAssignee: true,
      externalKey: true,
    },
  });

  for (const task of tasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        searchIndex: buildSearchIndex([
          task.title,
          task.description,
          task.progressNote,
          task.externalTaskKey,
          task.externalAssignee,
          task.externalKey,
        ]),
      },
    });
  }

  const letters = await prisma.letter.findMany({
    select: {
      id: true,
      number: true,
      subject: true,
      statusNote: true,
      responseRef: true,
      resolution: true,
      signatory: true,
      externalTaskKey: true,
      comment: true,
      counterparty: { select: { name: true, shortName: true } },
    },
  });

  for (const letter of letters) {
    await prisma.letter.update({
      where: { id: letter.id },
      data: {
        searchIndex: buildSearchIndex([
          letter.number,
          letter.subject,
          letter.counterparty?.name,
          letter.counterparty?.shortName,
          letter.statusNote,
          letter.responseRef,
          letter.resolution,
          letter.signatory,
          letter.externalTaskKey,
          letter.comment,
        ]),
      },
    });
  }

  const documents = await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      statusNote: true,
      nextAction: true,
      counterparty: { select: { name: true, shortName: true } },
    },
  });

  for (const document of documents) {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        searchIndex: buildSearchIndex([
          document.title,
          document.counterparty?.name,
          document.counterparty?.shortName,
          document.statusNote,
          document.nextAction,
        ]),
      },
    });
  }

  const meetings = await prisma.meeting.findMany({
    select: { id: true, subject: true, place: true, agenda: true, decisions: true },
  });

  for (const meeting of meetings) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        searchIndex: buildSearchIndex([
          meeting.subject,
          meeting.place,
          meeting.agenda,
          meeting.decisions,
        ]),
      },
    });
  }

  console.log(
    `Поиск пересобран: задач ${tasks.length}, писем ${letters.length}, ` +
      `документов ${documents.length}, встреч ${meetings.length}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
