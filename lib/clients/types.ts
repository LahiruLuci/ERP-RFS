import type { WorkerStatus, WorkerType } from "@/lib/workers/types";

export const clientStatuses = ["active", "inactive"] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const clientStatusLabels = {
  active: "Active",
  inactive: "Inactive",
} as const satisfies Record<ClientStatus, string>;

export type Client = {
  billing_address: string | null;
  client_code: string;
  contact_person: string | null;
  created_at?: string;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  status: ClientStatus;
  updated_at?: string;
  workplace_code: string;
};

export type ClientWithWorkpointCount = Client & {
  workpointCount: number;
};

export type Workpoint = {
  address: string | null;
  client_id: string;
  contact_person: string | null;
  contact_phone: string | null;
  created_at?: string;
  default_day_rate: number | string;
  default_night_rate: number | string;
  id: string;
  name: string;
  notes: string | null;
  required_guards: number | string;
  status: ClientStatus;
  updated_at?: string;
};

export type ClientInput = {
  billing_address: string | null;
  client_code: string;
  contact_person: string | null;
  email: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
  status: ClientStatus;
};

export type WorkpointInput = {
  address: string | null;
  client_id: string;
  contact_person: string | null;
  contact_phone: string | null;
  default_day_rate: number;
  default_night_rate: number;
  name: string;
  notes: string | null;
  required_guards: number;
  status: ClientStatus;
  workplace_code: string;
};

export type WorkpointPayrollEntry = {
  employee_no: string;
  entry_id: string;
  full_name: string;
  line_gross: number | string;
  payroll_record_id: string;
  shift_rate: number | string;
  shifts: number | string;
  worker_id: string;
  worker_status: WorkerStatus;
  worker_type: WorkerType;
};

export type WorkpointPayrollSummary = {
  contribution: number;
  entriesCount: number;
  shifts: number;
  workersCount: number;
};

export type WorkpointPayrollSaveInput = {
  client_operation_id?: string | null;
  entry_id: string | null;
  month: number;
  shift_rate: number;
  shifts: number;
  worker_id: string;
  workplace_id: string;
  year: number;
};
