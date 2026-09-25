import {
  documentKindLabel,
  documentStatusLabel,
  letterDirectionLabel,
  letterStatusLabel,
  signatureStatusLabel,
  trackColor,
  type DocumentStatus,
  type LetterStatus,
  type SignatureStatus,
} from "@/lib/domain";
import { Pill, type PillTone } from "@/components/ui";

/** Цвета из макета: новое — медное, в работе — синее, согласование — жёлтое, итог — зелёный. */
export const LETTER_STATUS_TONE: Record<LetterStatus, PillTone> = {
  NEW: "copper",
  IN_PROGRESS: "brand",
  ON_APPROVAL: "warn",
  ANSWERED: "good",
  SIGNED: "good",
  NOTED: "neutral",
  CLOSED: "neutral",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, PillTone> = {
  DRAFT: "neutral",
  REVIEW: "warn",
  RETURNED: "copper",
  SENT: "brand",
  SIGNING: "brand",
  SIGNED: "good",
  DECLINED: "bad",
  FILED: "neutral",
};

const SIGNATURE_STATUS_TONE: Record<SignatureStatus, PillTone> = {
  PENDING: "warn",
  SIGNED: "good",
  DECLINED: "bad",
  NOT_REQUIRED: "neutral",
};

export function LetterStatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={LETTER_STATUS_TONE[status as LetterStatus] ?? "neutral"}>
      {letterStatusLabel(status)}
    </Pill>
  );
}

export function DirectionBadge({ direction }: { direction: string }) {
  const className =
    direction === "INCOMING" ? "bg-brand-soft text-brand" : "bg-copper-soft text-copper";
  return <span className={`badge ${className}`}>{letterDirectionLabel(direction)}</span>;
}

/** Метка направления в реестре: «вх» синим, «исх» медным, как в макете. */
export function DirectionMark({ direction }: { direction: string }) {
  const incoming = direction === "INCOMING";
  return (
    <span
      title={letterDirectionLabel(direction)}
      className={`inline-grid h-[22px] w-[30px] flex-none place-items-center rounded-[7px] text-xs font-semibold ${
        incoming ? "bg-brand-soft text-brand" : "bg-copper-soft text-copper"
      }`}
    >
      {incoming ? "вх" : "исх"}
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={DOCUMENT_STATUS_TONE[status as DocumentStatus] ?? "neutral"}>
      {documentStatusLabel(status)}
    </Pill>
  );
}

export function DocumentKindBadge({ kind }: { kind: string }) {
  return <span className="badge bg-gray-100 text-gray-600">{documentKindLabel(kind)}</span>;
}

export function SignatureStatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={SIGNATURE_STATUS_TONE[status as SignatureStatus] ?? "neutral"}>
      {signatureStatusLabel(status)}
    </Pill>
  );
}

/** Трек — запись справочника: подпись и цвет приходят из него. */
export function TrackBadge({ track }: { track: { name: string; color: string } }) {
  return <span className={`badge ${trackColor(track.color).chip}`}>{track.name}</span>;
}
