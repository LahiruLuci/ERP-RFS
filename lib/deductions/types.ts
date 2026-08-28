export const workerDeductionTypes = [
  "advance",
  "meals",
  "uniform",
  "other",
] as const;

export const workerDeductionStatuses = ["active", "cancelled"] as const;

export type WorkerDeductionType = (typeof workerDeductionTypes)[number];
export type WorkerDeductionStatus = (typeof workerDeductionStatuses)[number];

export const workerDeductionTypeLabels = {
  advance: "Advance",
  meals: "Meals",
  other: "Other Deduction",
  uniform: "Uniform",
} as const satisfies Record<WorkerDeductionType, string>;

export const workerDeductionStatusLabels = {
  active: "Active",
  cancelled: "Cancelled",
} as const satisfies Record<WorkerDeductionStatus, string>;

export type WorkerDeduction = {
  amount: number | string;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_profile?: {
    full_name: string | null;
  } | null;
  id: string;
  note: string | null;
  payroll_record_id: string | null;
  status: WorkerDeductionStatus;
  transaction_date: string;
  type: WorkerDeductionType;
  worker_id: string;
};

export type WorkerDeductionSummary = {
  advance: number;
  meals: number;
  other: number;
  total: number;
  uniform: number;
};

export type WorkerDeductionSaveInput = {
  amount: number;
  id?: string | null;
  note: string | null;
  transaction_date: string;
  type: WorkerDeductionType;
  worker_id: string;
};
