import type { WorkerStatus, WorkerType } from "@/lib/workers/types";

export const payrollRunStatuses = ["draft", "approved"] as const;

export type PayrollRunStatus = (typeof payrollRunStatuses)[number];

export const payrollRunStatusLabels = {
  approved: "Approved",
  draft: "Draft",
} as const satisfies Record<PayrollRunStatus, string>;

export type PayrollWorker = {
  default_shift_rate: number | string | null;
  employee_no: string;
  full_name: string;
  id: string;
  joined_date: string | null;
  status: WorkerStatus;
  worker_type: WorkerType;
};

export type PayrollEmploymentEnd = {
  effective_date: string;
  status: Extract<WorkerStatus, "resigned" | "terminated">;
};

export type WorkplaceOption = {
  id: string;
  name: string;
  status: string;
};

export type PayrollWorkEntry = {
  id?: string;
  line_gross: number | string;
  payroll_record_id?: string;
  shift_rate: number | string;
  shifts: number | string;
  workplace_id: string | null;
  workplace_name: string;
};

export type PayrollRecord = {
  advance: number | string;
  advance_override?: boolean;
  created_at?: string;
  epf: number | string;
  gross_salary: number | string;
  id: string;
  meals: number | string;
  meals_override?: boolean;
  net_salary: number | string;
  other_deduction: number | string;
  other_deduction_override?: boolean;
  other_note: string | null;
  payroll_run_id: string;
  payroll_work_entries?: PayrollWorkEntry[];
  total_deductions: number | string;
  uniform: number | string;
  uniform_override?: boolean;
  worker_id: string;
};

export type PayrollRun = {
  id: string;
  month: number;
  status: PayrollRunStatus;
  year: number;
};

export type PayrollRow = {
  deductionSummary: {
    advance: number;
    meals: number;
    other: number;
    total: number;
    uniform: number;
  };
  record: PayrollRecord | null;
  employmentEnd: PayrollEmploymentEnd | null;
  worker: PayrollWorker;
};

export type PayrollSaveWorkEntry = {
  shift_rate: number;
  shifts: number;
  workplace_id: string | null;
};

export type PayrollSaveInput = {
  advance: number;
  advance_override: boolean;
  epf: number;
  meals: number;
  meals_override: boolean;
  month: number;
  other_deduction: number;
  other_deduction_override: boolean;
  other_note: string | null;
  uniform: number;
  uniform_override: boolean;
  worker_id: string;
  work_entries: PayrollSaveWorkEntry[];
  year: number;
};

