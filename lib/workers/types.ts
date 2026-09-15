export const workerStatuses = [
  "active",
  "inactive",
  "resigned",
  "terminated",
] as const;

export const workerGenders = ["Male", "Female", "Other"] as const;
export const workerTypes = ["permanent", "temporary"] as const;

export const emergencyContactRelationships = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Relative",
  "Friend",
  "Other",
] as const;

export type WorkerStatus = (typeof workerStatuses)[number];
export type WorkerGender = (typeof workerGenders)[number];
export type WorkerType = (typeof workerTypes)[number];
export type EmergencyContactRelationship =
  (typeof emergencyContactRelationships)[number];

export const workerStatusLabels = {
  active: "Active",
  inactive: "Inactive",
  resigned: "Resigned",
  terminated: "Terminated",
} as const satisfies Record<WorkerStatus, string>;

export const workerTypeLabels = {
  permanent: "Permanent",
  temporary: "Temporary",
} as const satisfies Record<WorkerType, string>;

export type Worker = {
  id: string;
  employee_no: string;
  worker_type: WorkerType;
  full_name: string;
  nic: string | null;
  date_of_birth: string | null;
  gender: WorkerGender | null;
  etf_no: string | null;
  epf_no: string | null;
  phone: string | null;
  secondary_phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: EmergencyContactRelationship | null;
  emergency_contact_phone: string | null;
  previous_occupation: string | null;
  previous_employer: string | null;
  joined_date: string | null;
  basic_salary: number | string | null;
  default_shift_rate: number | string | null;
  status: WorkerStatus;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WorkerInput = {
  employee_no: string;
  worker_type: WorkerType;
  full_name: string;
  nic: string | null;
  date_of_birth: string | null;
  gender: WorkerGender | null;
  etf_no: string | null;
  epf_no: string | null;
  phone: string | null;
  secondary_phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: EmergencyContactRelationship | null;
  emergency_contact_phone: string | null;
  previous_occupation: string | null;
  previous_employer: string | null;
  joined_date: string | null;
  basic_salary: number;
  default_shift_rate: number;
  status: WorkerStatus;
  notes: string | null;
};

export type TemporaryWorkerInput = {
  address: string | null;
  client_operation_id?: string | null;
  default_shift_rate: number;
  full_name: string;
  nic: string | null;
  notes: string | null;
  phone: string | null;
  worker_id?: string | null;
};

export type WorkerSaveInput = WorkerInput & {
  status_effective_date: string | null;
  status_reason: string | null;
  status_note: string | null;
};

export type WorkerStatusHistory = {
  id: string;
  worker_id: string;
  previous_status: WorkerStatus | null;
  new_status: WorkerStatus;
  effective_date: string;
  reason: string | null;
  note: string | null;
  changed_by: string | null;
  created_at: string;
  changed_by_profile?: {
    full_name: string | null;
  } | null;
};
