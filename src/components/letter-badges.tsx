import {
  documentKindLabel,
  documentStatusLabel,
  letterDirectionLabel,
  letterStatusLabel,
  signatureStatusLabel,
  taskTrackLabel,
  type DocumentStatus,
  type LetterStatus,
  type SignatureStatus,
  type TaskTrack,
} from "@/lib/domain";

const LETTER_STATUS_CLASS: Record<LetterStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  ON_APPROVAL: "bg-violet-50 text-violet-700",
  ANSWERED: "bg-emerald-50 text-emerald-700",
  SIGNED: "bg-emerald-50 text-emerald-700",
  NOTED: "bg-gray-100 text-gray-600",
  CLOSED: "bg-gray-100 text-gray-600",
};

const DOCUMENT_STATUS_CLASS: Record<DocumentStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REVIEW: "bg-violet-50 text-violet-700",
  SENT: "bg-blue-50 text-blue-700",
  SIGNING: "bg-amber-50 text-amber-700",
  SIGNED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-red-50 text-red-700",
};

const SIGNATURE_STATUS_CLASS: Record<SignatureStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SIGNED: "bg-emerald-50 text-emerald-700",
  DECLINED: "bg-red-50 text-red-700",
  NOT_REQUIRED: "bg-gray-100 text-gray-500",
};

const TRACK_CLASS: Record<TaskTrack, string> = {
  PRODUCTION: "bg-sky-50 text-sky-700",
  INTERNAL: "bg-gray-100 text-gray-600",
  EXTERNAL: "bg-teal-50 text-teal-700",
  LEGAL: "bg-violet-50 text-violet-700",
};

export function LetterStatusBadge({ status }: { status: string }) {
  const className = LETTER_STATUS_CLASS[status as LetterStatus] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{letterStatusLabel(status)}</span>;
}

export function DirectionBadge({ direction }: { direction: string }) {
  const className =
    direction === "INCOMING" ? "bg-indigo-50 text-indigo-700" : "bg-orange-50 text-orange-700";
  return <span className={`badge ${className}`}>{letterDirectionLabel(direction)}</span>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const className = DOCUMENT_STATUS_CLASS[status as DocumentStatus] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{documentStatusLabel(status)}</span>;
}

export function DocumentKindBadge({ kind }: { kind: string }) {
  return <span className="badge bg-gray-100 text-gray-600">{documentKindLabel(kind)}</span>;
}

export function SignatureStatusBadge({ status }: { status: string }) {
  const className = SIGNATURE_STATUS_CLASS[status as SignatureStatus] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{signatureStatusLabel(status)}</span>;
}

export function TrackBadge({ track }: { track: string }) {
  const className = TRACK_CLASS[track as TaskTrack] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{taskTrackLabel(track)}</span>;
}
