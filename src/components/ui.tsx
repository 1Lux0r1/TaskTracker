import type { ReactNode } from "react";
import { describeDue, type DueState } from "@/lib/domain";

/*
 * Общий язык блоков из утверждённых макетов: значок в мягком квадрате,
 * заголовок с поясняющей строкой, срок словами, кружок с инициалами и
 * пилюля состояния. Экраны собираются из этих кусков, чтобы выглядеть
 * одинаково.
 */

const ICON_PATHS = {
  alert: (
    <>
      <path d="M12 9v4.5M12 17h.01" />
      <path d="M10.3 3.9 2.4 17.1A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>
  ),
  pen: (
    <>
      <path d="M12 19h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7.5 15v3M12 10v8M16.5 6.5V18" />
    </>
  ),
  users: (
    <>
      <path d="M15.5 19v-1.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4V19" />
      <circle cx="9" cy="7.5" r="3.4" />
      <path d="M17 11.2a3.6 3.6 0 0 0 0-7.2" />
      <path d="M22 19v-1.5a4 4 0 0 0-3-3.8" />
    </>
  ),
  flow: (
    <>
      <rect x="3" y="3.5" width="7.5" height="6" rx="2" />
      <rect x="13.5" y="14.5" width="7.5" height="6" rx="2" />
      <path d="M6.8 9.5v5a3 3 0 0 0 3 3h3.7" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.8A2.8 2.8 0 0 1 6.8 2H20v15.5H6.8A2.8 2.8 0 0 0 4 20.3Z" />
      <path d="M4 17.5h16V21H6.8" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18" />
      <path d="M5.5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16" />
      <path d="M14.5 9.5H17a2 2 0 0 1 2 2V21" />
      <path d="M9 7.5h1.5M9 11.5h1.5M9 15.5h1.5" />
    </>
  ),
  contact: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <circle cx="8.6" cy="10.8" r="2.2" />
      <path d="M5.2 16.3c.6-1.5 1.9-2.3 3.4-2.3s2.8.8 3.4 2.3" />
      <path d="M15 10h4M15 14h4" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 4.8-9 4.8-9-4.8Z" />
      <path d="m3 13.2 9 4.8 9-4.8" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.8 2.8L16 9.6" />
    </>
  ),
  file: (
    <>
      <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5Z" />
      <path d="M13.6 2.5v5.2h5.2" />
    </>
  ),
  task: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** Цвет блока: полоса сверху, значок и акценты внутри. */
export type Tone = "brand" | "copper" | "good" | "bad" | "violet";

const TONES: Record<Tone, { accent: string; soft: string }> = {
  brand: { accent: "var(--color-brand)", soft: "var(--color-brand-soft)" },
  copper: { accent: "var(--color-copper)", soft: "var(--color-copper-soft)" },
  good: { accent: "var(--color-green-600)", soft: "var(--color-green-50)" },
  bad: { accent: "var(--color-red-600)", soft: "var(--color-red-50)" },
  violet: { accent: "var(--color-purple-600)", soft: "var(--color-purple-50)" },
};

/** Переменные цвета для `card-accent` и `CardHead`. */
export function toneStyle(tone: Tone): React.CSSProperties {
  return { "--accent": TONES[tone].accent, "--accent-soft": TONES[tone].soft } as React.CSSProperties;
}

/** Шапка карточки: значок в мягком квадрате, заголовок, пояснение, действие справа. */
export function CardHead({
  icon,
  title,
  sub,
  action,
}: {
  icon: IconName;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-start gap-3">
      <span
        className="grid size-[30px] flex-none place-items-center rounded-[9px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15.5px] leading-snug font-semibold text-gray-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-gray-500">{sub}</p>}
      </div>
      {action && <div className="ml-auto flex-none">{action}</div>}
    </div>
  );
}

/** Карточка с цветной полосой и шапкой — основной блок экранов. */
export function Block({
  tone = "brand",
  icon,
  title,
  sub,
  action,
  children,
  className = "",
  flush = false,
}: {
  tone?: Tone;
  icon: IconName;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Строки списка во всю ширину карточки, без боковых полей. */
  flush?: boolean;
}) {
  return (
    <section
      style={toneStyle(tone)}
      className={`card card-accent flex min-w-0 flex-col ${flush ? "pt-[18px]" : "p-[18px]"} ${className}`}
    >
      <div className={flush ? "px-[18px]" : ""}>
        <CardHead icon={icon} title={title} sub={sub} action={action} />
      </div>
      {children}
    </section>
  );
}

const DUE_CLASS: Record<DueState, string> = {
  none: "text-gray-500",
  done: "text-gray-600",
  over: "font-medium text-red-600",
  soon: "font-medium text-amber-600",
  later: "text-gray-900",
};

/**
 * Срок в строке: просрочка днями красным, ближайшая неделя оранжевым.
 * `words` — писать ли «через 3 дн.» вместо даты.
 */
export function DueTag({
  date,
  closed = false,
  words = false,
  className = "",
}: {
  date: Date | null | undefined;
  closed?: boolean;
  words?: boolean;
  className?: string;
}) {
  const due = describeDue(date, { closed });
  const text =
    words || due.state === "none" || due.state === "done"
      ? due.text
      : due.state === "over" || due.state === "soon"
        ? shortDate(date)
        : due.text;
  return (
    <span className={`font-mono text-[13px] whitespace-nowrap tabular-nums ${DUE_CLASS[due.state]} ${className}`}>
      {text}
    </span>
  );
}

function shortDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(date);
}

/** Кружок с инициалами: «Шаганова Елена» → «ШЕ». */
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={`font-display grid flex-none place-items-center rounded-full bg-brand-soft font-semibold text-brand ${
        small ? "size-[21px] text-[9px]" : "size-[26px] text-[10.5px]"
      }`}
    >
      {letters}
    </span>
  );
}

/** Человек в строке: кружок и имя. */
export function Who({ name, empty = "не назначен" }: { name: string | null | undefined; empty?: string }) {
  if (!name) return <span className="text-[13.5px] text-red-600">{empty}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13.5px] text-gray-900">
      <Avatar name={name} small />
      <span className="truncate">{name}</span>
    </span>
  );
}

export type PillTone = "neutral" | "brand" | "good" | "warn" | "bad" | "copper" | "violet";

const PILL_CLASS: Record<PillTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  brand: "bg-brand-soft text-brand",
  good: "bg-green-50 text-green-600",
  warn: "bg-amber-50 text-amber-600",
  bad: "bg-red-50 text-red-600",
  copper: "bg-copper-soft text-copper",
  violet: "bg-purple-50 text-purple-600",
};

/** Пилюля состояния с точкой: цвет не единственный носитель смысла — рядом всегда слово. */
export function Pill({
  tone = "neutral",
  children,
  dot = true,
}: {
  tone?: PillTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap ${PILL_CLASS[tone]}`}
    >
      {dot && <i aria-hidden className="block size-1.5 flex-none rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Плитка свойства в карточке записи: подпись капсом, значение ниже. */
export function Prop({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-[10px] bg-gray-100 px-3 py-2.5 ${wide ? "col-span-full" : ""}`}>
      <span className="mb-1 block text-[11px] tracking-[0.06em] text-gray-500 uppercase">{label}</span>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

/** Заголовок раздела внутри карточки записи: цветной квадратик и капс. */
export function SectionCap({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.07em] text-gray-500 uppercase">
      <i aria-hidden className="block size-1.5 rounded-[2px] bg-brand" />
      {children}
    </h3>
  );
}
