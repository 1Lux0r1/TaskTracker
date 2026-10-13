import {
  createPlanModule,
  deletePlanModule,
  deletePlanPart,
  deletePlanStage,
  deletePlanSubsystem,
  rebuildPlanCiphers,
  savePlanPart,
  savePlanStage,
  savePlanSubsystem,
  savePlanSystem,
  updatePlanModule,
} from "@/app/actions/planning";
import { ActionForm } from "@/components/planning/action-form";
import { RowDelete } from "@/components/planning/row-delete";
import { SystemSwitch } from "@/components/planning/system-switch";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { PLAN_STAGE_LEVELS, plural } from "@/lib/domain";
import { CIPHER_SETTINGS, formatPlanNumber } from "@/lib/planning/cipher";
import { pickSystem } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

const SEGMENT_LABELS: Record<string, string> = {
  system: "СИСТЕМА",
  direction: "НАПРАВЛЕНИЕ",
  part: "ЧАСТЬ",
  subsystem: "ПОДСИСТЕМА",
  dk: "ДК",
  ms: "МС",
  stage: "ЭТАП",
};

const small = "btn-secondary px-2.5 py-1 text-[13px]";
const inline = "input mt-0 py-1.5";

/** Справочники модуля: система, направления и части, подсистемы, МС, этапы. */
export default async function PlanningDirectoryPage(props: PageProps<"/planning/directory">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);

  const [directions, subsystems, modules, stages] = system
    ? await Promise.all([
        prisma.planDirection.findMany({
          where: { systemId: system.id },
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          include: {
            parts: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
              include: { _count: { select: { dks: true } } },
            },
          },
        }),
        prisma.planSubsystem.findMany({
          where: { systemId: system.id },
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          include: { _count: { select: { modules: true, dks: true } } },
        }),
        prisma.planModule.findMany({
          where: { systemId: system.id },
          orderBy: { number: "asc" },
          include: { _count: { select: { tasks: true } } },
        }),
        prisma.planStage.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
      ])
    : [[], [], [], await prisma.planStage.findMany({ orderBy: [{ sortOrder: "asc" }] })];

  const format = CIPHER_SETTINGS.segments.map((segment) => SEGMENT_LABELS[segment]).join(".");

  return (
    <div className="space-y-3.5">
      {system && <SystemSwitch systems={systems} selected={system.id} basePath="/planning/directory" />}

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card title="Система" note="Код системы — первый сегмент шифра">
          <ActionForm action={savePlanSystem} className="flex flex-wrap items-end gap-2 px-4.5 pb-4.5">
            {system && <input type="hidden" name="id" value={system.id} />}
            <label className="field">
              Код
              <input name="code" required maxLength={12} defaultValue={system?.code ?? "RKII"} className="input block w-28 font-mono" />
            </label>
            <label className="field min-w-48 flex-1">
              Название
              <input name="name" required defaultValue={system?.name ?? "АИС РКИИЭ"} className="input" />
            </label>
            <SubmitButton>{system ? "Сохранить" : "Завести систему"}</SubmitButton>
          </ActionForm>
          {system && (
            <p className="px-4.5 pb-4.5 text-[13px] text-gray-500">
              Последний выданный номер МС — {formatPlanNumber(system.lastMsNumber)}. Номера не
              переиспользуются.
            </p>
          )}
        </Card>

        <Card title="Формат шифра" note="Порядок сегментов и источник подсистемы задаются в одном месте кода">
          <div className="px-4.5 pb-4.5">
            <p className="font-mono text-[13px] break-all text-gray-900">{format}</p>
            <p className="mt-1 text-[13px] text-gray-500">
              Подсистема берётся {CIPHER_SETTINGS.subsystemSource === "dk" ? "из ДК" : "из МС"}. Неизвестные
              позиции опускаются, номер повтора дописывается к этапу: Р2, СА2.
            </p>
            <ActionForm action={rebuildPlanCiphers} className="mt-3">
              <SubmitButton className={small} pendingLabel="Пересобираем…">
                Пересобрать шифры
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>
      </div>

      {system && (
        <>
          <div className="grid gap-3.5 lg:grid-cols-2">
            <Card id="parts" title="Направления и части" note="Блок — пара «направление + часть»; ДК ведутся в блоке">
              {directions.length === 0 && (
                <p className="px-4.5 pb-4.5 text-sm text-gray-500">Сначала заведите направление на вкладке «Направления».</p>
              )}
              {directions.map((direction) => (
                <div key={direction.id} className="border-t border-gray-200 px-4.5 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="font-mono">{direction.code}</span> · {direction.name}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {direction.parts.map((part) => (
                      <li key={part.id} className="flex flex-wrap items-start gap-2">
                        <ActionForm action={savePlanPart} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={part.id} />
                          <input type="hidden" name="directionId" value={direction.id} />
                          <input name="code" aria-label="Код части" defaultValue={part.code} required className={`${inline} w-20 font-mono`} />
                          <input name="name" aria-label="Название части" defaultValue={part.name} required className={`${inline} min-w-36 flex-1`} />
                          <span className="text-[12.5px] text-gray-500">{part._count.dks} ДК</span>
                          <SubmitButton className={small}>Сохранить</SubmitButton>
                        </ActionForm>
                        {part._count.dks === 0 && <RowDelete action={deletePlanPart} id={part.id} question="Удалить часть?" />}
                      </li>
                    ))}
                  </ul>
                  <ActionForm action={savePlanPart} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="directionId" value={direction.id} />
                    <input name="code" aria-label="Код новой части" placeholder="Код" required className={`${inline} w-20 font-mono`} />
                    <input name="name" aria-label="Название новой части" placeholder="Новая часть" required className={`${inline} min-w-36 flex-1`} />
                    <SubmitButton className={small}>Добавить</SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </Card>

            <Card title="Подсистемы" note={`${subsystems.length} ${plural(subsystems.length, "подсистема", "подсистемы", "подсистем")}; список из книги предварительный`}>
              <ul className="border-t border-gray-200">
                {subsystems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start gap-2 border-b border-gray-200 px-4.5 py-2">
                    <ActionForm action={savePlanSubsystem} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="systemId" value={system.id} />
                      <input name="code" aria-label="Код подсистемы" defaultValue={item.code} required className={`${inline} w-20 font-mono`} />
                      <input name="name" aria-label="Название подсистемы" defaultValue={item.name} required className={`${inline} min-w-36 flex-1`} />
                      <span className="text-[12.5px] text-gray-500">МС {item._count.modules}</span>
                      <SubmitButton className={small}>Сохранить</SubmitButton>
                    </ActionForm>
                    {item._count.modules + item._count.dks === 0 && (
                      <RowDelete action={deletePlanSubsystem} id={item.id} question="Удалить подсистему?" />
                    )}
                  </li>
                ))}
              </ul>
              <ActionForm action={savePlanSubsystem} className="flex flex-wrap items-center gap-2 px-4.5 py-3">
                <input type="hidden" name="systemId" value={system.id} />
                <input name="code" aria-label="Код новой подсистемы" placeholder="Код" required className={`${inline} w-20 font-mono`} />
                <input name="name" aria-label="Название новой подсистемы" placeholder="Новая подсистема" required className={`${inline} min-w-36 flex-1`} />
                <SubmitButton className={small}>Добавить</SubmitButton>
              </ActionForm>
            </Card>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Card title="МС" note={`${modules.length} МС; номер выдаёт система, версия ведётся руками и в шифр не входит`}>
              <ActionForm action={createPlanModule} className="flex flex-wrap items-center gap-2 px-4.5 pb-3">
                <input name="name" aria-label="Название нового МС" placeholder="Новый МС, например terra-analyser-bff" required className={`${inline} min-w-48 flex-1`} />
                <SubsystemSelect subsystems={subsystems} />
                <input name="version" aria-label="Версия" placeholder="Версия" className={`${inline} w-24`} />
                <SubmitButton className={small}>
                  Добавить как {formatPlanNumber(system.lastMsNumber + 1)}
                </SubmitButton>
              </ActionForm>
              <ul className="max-h-[640px] overflow-y-auto border-t border-gray-200">
                {modules.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start gap-2 border-b border-gray-200 px-4.5 py-2">
                    <span className="mt-1.5 w-9 font-mono text-sm font-semibold text-gray-900">{formatPlanNumber(item.number)}</span>
                    <ActionForm action={updatePlanModule} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input name="name" aria-label="Название МС" defaultValue={item.name} required className={`${inline} min-w-40 flex-1`} />
                      <SubsystemSelect subsystems={subsystems} value={item.subsystemId} />
                      <input name="version" aria-label="Версия" defaultValue={item.version ?? ""} placeholder="Версия" className={`${inline} w-20`} />
                      <SubmitButton className={small}>Сохранить</SubmitButton>
                    </ActionForm>
                    {item._count.tasks === 0 && <RowDelete action={deletePlanModule} id={item.id} question="Удалить МС? Номер не вернётся" />}
                  </li>
                ))}
                {modules.length === 0 && <li className="px-4.5 py-3 text-sm text-gray-500">МС пока нет.</li>}
              </ul>
            </Card>

            <Card title="Этапы" note="Уровень: к чему относится задача этапа — к ДК или к МС">
              <ul className="border-t border-gray-200">
                {stages.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start gap-2 border-b border-gray-200 px-4.5 py-2">
                    <ActionForm action={savePlanStage} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input name="code" aria-label="Код этапа" defaultValue={item.code} required className={`${inline} w-20 font-mono`} />
                      <input name="name" aria-label="Название этапа" defaultValue={item.name} required className={`${inline} min-w-32 flex-1`} />
                      <LevelSelect value={item.level} />
                      <SubmitButton className={small}>Сохранить</SubmitButton>
                    </ActionForm>
                    <RowDelete action={deletePlanStage} id={item.id} question="Удалить этап?" />
                  </li>
                ))}
              </ul>
              <ActionForm action={savePlanStage} className="flex flex-wrap items-center gap-2 px-4.5 py-3">
                <input name="code" aria-label="Код нового этапа" placeholder="Код" required className={`${inline} w-20 font-mono`} />
                <input name="name" aria-label="Название нового этапа" placeholder="Новый этап" required className={`${inline} min-w-32 flex-1`} />
                <LevelSelect value="MS" />
                <SubmitButton className={small}>Добавить</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ id, title, note, children }: { id?: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card card-accent overflow-hidden">
      <div className="px-4.5 pt-4.5 pb-3">
        <h2 className="font-display text-[15.5px] font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{note}</p>
      </div>
      {children}
    </section>
  );
}

function SubsystemSelect({ subsystems, value }: { subsystems: { id: string; code: string }[]; value?: string }) {
  return (
    <select name="subsystemId" aria-label="Подсистема" defaultValue={value ?? ""} required className={`${inline} w-28`}>
      <option value="" disabled>
        Подсистема
      </option>
      {subsystems.map((item) => (
        <option key={item.id} value={item.id}>
          {item.code}
        </option>
      ))}
    </select>
  );
}

function LevelSelect({ value }: { value: string }) {
  return (
    <select name="level" aria-label="Уровень" defaultValue={value} className={`${inline} w-32`}>
      {PLAN_STAGE_LEVELS.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
