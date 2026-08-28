import {
  workerStatusLabels,
  workerTypeLabels,
  type WorkerStatus,
  type WorkerType,
} from "@/lib/workers/types";

const statusClassNames = {
  active:
    "border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]",
  inactive:
    "border-[var(--status-inactive-border)] bg-[var(--status-inactive-bg)] text-[var(--status-inactive-text)]",
  resigned:
    "border-[var(--status-resigned-border)] bg-[var(--status-resigned-bg)] text-[var(--status-resigned-text)]",
  terminated:
    "border-[var(--status-terminated-border)] bg-[var(--status-terminated-bg)] text-[var(--status-terminated-text)]",
} as const satisfies Record<WorkerStatus, string>;

const dotClassNames = {
  active: "bg-[var(--status-active-text)]",
  inactive: "bg-[var(--status-inactive-text)]",
  resigned: "bg-[var(--status-resigned-text)]",
  terminated: "bg-[var(--status-terminated-text)]",
} as const satisfies Record<WorkerStatus, string>;

export function formatWorkerStatus(status: WorkerStatus | null | undefined) {
  return status ? workerStatusLabels[status] : "-";
}

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassNames[status]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${dotClassNames[status]}`}
      />
      {workerStatusLabels[status]}
    </span>
  );
}

export function formatWorkerType(type: WorkerType | null | undefined) {
  return type ? workerTypeLabels[type] : "-";
}

export function WorkerTypeBadge({ type }: { type: WorkerType }) {
  const className =
    type === "temporary"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {workerTypeLabels[type]}
    </span>
  );
}
