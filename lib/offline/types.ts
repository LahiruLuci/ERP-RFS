import type { ClientStatus } from "@/lib/clients/types";
import type {
  WorkerDeductionStatus,
  WorkerDeductionType,
} from "@/lib/deductions/types";
import type { WorkerStatus, WorkerType } from "@/lib/workers/types";

export type CacheStoreName = "workers" | "clients" | "workpoints";

export type CacheMetadata = {
  id:
    | CacheStoreName
    | "payrollWorkEntries"
    | "payrollWorkspaces"
    | "pendingMutations"
    | "workerDeductions";
  count: number;
  updatedAt: string;
};

export type CachedWorker = {
  address?: string | null;
  default_shift_rate: number;
  employee_no: string;
  full_name: string;
  id: string;
  joined_date: string | null;
  local_only?: boolean;
  nic: string | null;
  notes?: string | null;
  operation_id?: string | null;
  phone: string | null;
  status: WorkerStatus;
  sync_status?: "failed" | "pending" | "syncing" | "synced";
  updated_at: string | null;
  user_id?: string | null;
  worker_type: WorkerType;
};

export type CachedClient = {
  client_code: string;
  id: string;
  name: string;
  status: ClientStatus;
  updated_at: string | null;
  workpointCount?: number;
};

export type CachedWorkpoint = {
  client_id: string;
  default_day_rate: number;
  default_night_rate: number;
  id: string;
  name: string;
  status: ClientStatus;
  updated_at: string | null;
};

export type CachedPayrollWorkspace = {
  client_id: string;
  client_name: string;
  eligible_workers: CachedWorker[];
  eligible_worker_ids: string[];
  id: string;
  month: number;
  period_end: string;
  period_start: string;
  updated_at: string;
  workpoint_default_day_rate: number;
  workpoint_id: string;
  workpoint_name: string;
  year: number;
};

export type CachedPayrollWorkEntry = {
  client_id: string;
  employee_no: string;
  entry_id: string;
  full_name: string;
  line_gross: number;
  local_only: boolean;
  month: number;
  operation_id: string | null;
  payroll_record_id: string | null;
  shift_rate: number;
  shifts: number;
  sync_status: "pending" | "syncing" | "failed" | "synced";
  user_id: string | null;
  worker_id: string;
  worker_status: WorkerStatus;
  worker_type: WorkerType;
  workplace_id: string;
  year: number;
};

export type OfflineWorkEntryPayload = {
  client_id: string;
  client_operation_id: string;
  month: number;
  shift_rate: number;
  shifts: number;
  worker_id: string;
  workplace_id: string;
  year: number;
};

export type CachedWorkerDeduction = {
  amount: number;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  deduction_id: string;
  local_only: boolean;
  month: number;
  note: string | null;
  operation_id: string | null;
  payroll_record_id: string | null;
  status: WorkerDeductionStatus;
  sync_status: "pending" | "syncing" | "failed" | "synced";
  transaction_date: string;
  type: WorkerDeductionType;
  user_id: string | null;
  worker_id: string;
  year: number;
};

export type OfflineDeductionPayload = {
  amount: number;
  client_operation_id: string;
  month: number;
  note: string | null;
  transaction_date: string;
  type: WorkerDeductionType;
  worker_id: string;
  year: number;
};

export type OfflineTemporaryWorkerPayload = {
  address: string | null;
  client_operation_id: string;
  default_shift_rate: number;
  full_name: string;
  nic: string | null;
  notes: string | null;
  phone: string | null;
  worker_id: string;
};

export type PendingMutationStatus = "failed" | "pending" | "syncing";

export type PendingMutation = {
  created_at: string;
  depends_on_operation_id?: string | null;
  entity_id?: string | null;
  entity_type: "payroll_work_entry" | "temporary_worker" | "worker_deduction";
  id: string;
  last_error: string | null;
  operation_id: string;
  operation_type: "create";
  payload:
    | OfflineDeductionPayload
    | OfflineTemporaryWorkerPayload
    | OfflineWorkEntryPayload;
  retry_count: number;
  status: PendingMutationStatus;
  updated_at: string;
  user_id: string;
};
