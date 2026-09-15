export type DashboardRole = "owner" | "admin" | "accounts" | string;

/**
 * Workforce metrics for the selected payroll month.
 *
 * A. Period-relevant permanent workers:
 *    - Permanent workers employed for at least one day during the selected month.
 *    - Uses joined_date + worker_status_history effective dates, matching
 *      the existing payroll eligibility logic.
 *
 * B. Current status snapshots:
 *    - activePermanentWorkers / inactivePermanentWorkers reflect the CURRENT
 *      workers table status, not a historical "active as of month-end" count.
 *      They are informational snapshots, not period-eligible counts.
 *
 * C. Status events during selected month:
 *    - resignedThisMonth / terminatedThisMonth count worker_status_history rows
 *      whose effective_date falls within the selected month.
 *
 * D. Temporary workers used:
 *    - Distinct temporary workers with payroll_work_entries in the selected month.
 */
export type WorkforceMetrics = {
  activePermanentWorkers: number;
  inactivePermanentWorkers: number;
  periodRelevantPermanentWorkers: number;
  resignedThisMonth: number;
  terminatedThisMonth: number;
  temporaryWorkersUsed: number;
  totalPermanentWorkers: number;
  unauthorized: boolean;
};

export type ClientWorkpointMetrics = {
  activeClients: number;
  totalClients: number;
  totalWorkpoints: number;
  activeWorkpoints: number;
  workpointsUsed: number;
  workpointsWithZeroActivity: number;
  unauthorized: boolean;
};

export type PayrollSummary = {
  exists: boolean;
  grossSalary: number;
  netSalary: number;
  runId: string | null;
  status: "draft" | "approved" | null;
  totalDeductions: number;
  totalShifts: number;
  unauthorized: boolean;
  workerCount: number;
};

export type PayrollTrendMonth = {
  deductions: number;
  exists: boolean;
  gross: number;
  label: string;
  month: number;
  net: number;
  status: "draft" | "approved" | null;
  year: number;
};

export type ClientContribution = {
  clientCode: string;
  clientId: string;
  clientName: string;
  contribution: number;
  shifts: number;
  uniqueWorkers: number;
  workpointsUsed: number;
};

export type AttentionAlert = {
  count?: number;
  description: string;
  severity: "info" | "warning" | "error";
  targetRoute?: string;
  title: string;
  type: string;
};

export type RecentUpdate = {
  description: string;
  id: string;
  label: string;
  targetRoute?: string;
  timestamp: string;
  type: "payroll_run" | "worker_status_change";
};

export type DashboardData = {
  alerts: AttentionAlert[];
  clientsWorkpoints: ClientWorkpointMetrics;
  payroll: PayrollSummary;
  recentUpdates: RecentUpdate[];
  role: DashboardRole;
  topClients: ClientContribution[];
  trend: PayrollTrendMonth[];
  workforce: WorkforceMetrics;
  periodLabel: string;
};

export type DashboardError = {
  message: string;
  section: string;
};

export type DashboardResult = {
  data: DashboardData;
  errors: DashboardError[];
};
