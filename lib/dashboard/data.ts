import "server-only";

import { createClient } from "@/lib/supabase/server";

export type {
  AttentionAlert,
  ClientContribution,
  ClientWorkpointMetrics,
  DashboardData,
  DashboardError,
  DashboardResult,
  PayrollSummary,
  PayrollTrendMonth,
  RecentUpdate,
  WorkforceMetrics,
} from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DASHBOARD_ACCESS_ROLES = [
  "owner",
  "admin",
  "accounts",
] as const;

type DashboardAccessRole = (typeof DASHBOARD_ACCESS_ROLES)[number];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function readPeriod(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizePeriod(year: number, month: number) {
  const now = new Date();
  const safeYear = year >= 2000 && year <= 2100 ? year : now.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : now.getMonth() + 1;

  return { month: safeMonth, year: safeYear };
}

function getPeriodStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function getPeriodEnd(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

async function getCurrentRole(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active !== true) {
    return null;
  }

  return String(profile.role);
}

function hasDashboardAccess(role: string | null): boolean {
  if (!role) {
    return false;
  }

  return DASHBOARD_ACCESS_ROLES.includes(role as DashboardAccessRole);
}

type EmploymentEndEvent = {
  effective_date: string;
  new_status: string;
  worker_id: string;
};

function isEmploymentEndStatus(
  status: string,
): status is Extract<string, "resigned" | "terminated"> {
  return status === "resigned" || status === "terminated";
}

async function getLatestEmploymentEndEvents(
  supabase: SupabaseServerClient,
  workerIds: string[],
  periodEnd: string,
): Promise<Map<string, EmploymentEndEvent>> {
  const latestEndEventByWorkerId = new Map<string, EmploymentEndEvent>();

  if (workerIds.length === 0) {
    return latestEndEventByWorkerId;
  }

  const { data, error } = await supabase
    .from("worker_status_history")
    .select("worker_id, new_status, effective_date")
    .in("worker_id", workerIds)
    .in("new_status", ["resigned", "terminated"])
    .lte("effective_date", periodEnd)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return latestEndEventByWorkerId;
  }

  for (const event of (data ?? []) as EmploymentEndEvent[]) {
    if (!latestEndEventByWorkerId.has(event.worker_id)) {
      latestEndEventByWorkerId.set(event.worker_id, event);
    }
  }

  return latestEndEventByWorkerId;
}

function isPermanentWorkerRelevantForPeriod(
  worker: { joined_date: string | null; status: string },
  latestEndEvent: EmploymentEndEvent | undefined,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (worker.joined_date === null || worker.joined_date > periodEnd) {
    return false;
  }

  if (!isEmploymentEndStatus(worker.status) || !latestEndEvent) {
    return true;
  }

  return latestEndEvent.effective_date >= periodStart;
}

async function getWorkforceMetrics(
  supabase: SupabaseServerClient,
  periodStart: string,
  periodEnd: string,
): Promise<{ data: import("./types").WorkforceMetrics; error: string | null }> {
  try {
    const { data: workers, error: workersError } = await supabase
      .from("workers")
      .select("id, worker_type, status, joined_date")
      .eq("worker_type", "permanent");

    if (workersError) {
      return {
        data: {
          activePermanentWorkers: 0,
          inactivePermanentWorkers: 0,
          periodRelevantPermanentWorkers: 0,
          resignedThisMonth: 0,
          terminatedThisMonth: 0,
          temporaryWorkersUsed: 0,
          totalPermanentWorkers: 0,
          unauthorized: false,
        },
        error: "Unable to load workforce data.",
      };
    }

    const workerList = (workers ?? []) as Array<{
      id: string;
      joined_date: string | null;
      status: string;
    }>;

    const latestEndEvents = await getLatestEmploymentEndEvents(
      supabase,
      workerList.map((w) => w.id),
      periodEnd,
    );

    const periodRelevantPermanentWorkers = workerList.filter((w) =>
      isPermanentWorkerRelevantForPeriod(w, latestEndEvents.get(w.id), periodStart, periodEnd),
    ).length;

    const activePermanentWorkers = workerList.filter(
      (w) => w.status === "active",
    ).length;
    const inactivePermanentWorkers = workerList.filter(
      (w) => w.status === "inactive",
    ).length;
    const totalPermanentWorkers = workerList.length;

    const { data: statusHistory, error: historyError } = await supabase
      .from("worker_status_history")
      .select("new_status, effective_date")
      .gte("effective_date", periodStart)
      .lte("effective_date", periodEnd)
      .in("new_status", ["resigned", "terminated"]);

    if (historyError) {
      return {
        data: {
          activePermanentWorkers,
          inactivePermanentWorkers,
          periodRelevantPermanentWorkers,
          resignedThisMonth: 0,
          terminatedThisMonth: 0,
          temporaryWorkersUsed: 0,
          totalPermanentWorkers,
          unauthorized: false,
        },
        error: "Unable to load worker status history.",
      };
    }

    const history = (statusHistory ?? []) as Array<{
      new_status: string;
      effective_date: string;
    }>;

    const resignedThisMonth = history.filter(
      (h) => h.new_status === "resigned",
    ).length;
    const terminatedThisMonth = history.filter(
      (h) => h.new_status === "terminated",
    ).length;

    return {
      data: {
        activePermanentWorkers,
        inactivePermanentWorkers,
        periodRelevantPermanentWorkers,
        resignedThisMonth,
        terminatedThisMonth,
        temporaryWorkersUsed: 0,
        totalPermanentWorkers,
        unauthorized: false,
      },
      error: null,
    };
  } catch {
    return {
      data: {
        activePermanentWorkers: 0,
        inactivePermanentWorkers: 0,
        periodRelevantPermanentWorkers: 0,
        resignedThisMonth: 0,
        terminatedThisMonth: 0,
        temporaryWorkersUsed: 0,
        totalPermanentWorkers: 0,
        unauthorized: false,
      },
      error: "Unable to load workforce data.",
    };
  }
}

async function getTemporaryWorkersUsed(
  supabase: SupabaseServerClient,
  runId: string | null,
): Promise<number> {
  if (!runId) {
    return 0;
  }

  const { data, error } = await supabase
    .from("payroll_work_entries")
    .select(`
      id,
      payroll_record_id,
      payroll_records!inner (
        worker_id,
        workers!inner (
          worker_type
        )
      )
    `)
    .eq("payroll_records.payroll_run_id", runId)
    .eq("payroll_records.workers.worker_type", "temporary");

  if (error || !data) {
    return 0;
  }

  const workerIds = new Set<string>();
  const entries = data as unknown as Array<{
    payroll_records: {
      worker_id: string;
      workers: { worker_type: string } | { worker_type: string }[];
    } | Array<{
      worker_id: string;
      workers: { worker_type: string } | { worker_type: string }[];
    }>;
  }>;

  for (const entry of entries) {
    const record = Array.isArray(entry.payroll_records)
      ? entry.payroll_records[0]
      : entry.payroll_records;

    if (record?.worker_id) {
      workerIds.add(record.worker_id);
    }
  }

  return workerIds.size;
}

async function getClientWorkpointMetrics(
  supabase: SupabaseServerClient,
  runId: string | null,
): Promise<{ data: import("./types").ClientWorkpointMetrics; error: string | null }> {
  try {
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, status")
      .order("name", { ascending: true });

    if (clientsError) {
      return {
        data: {
          activeClients: 0,
          totalClients: 0,
          totalWorkpoints: 0,
          activeWorkpoints: 0,
          workpointsUsed: 0,
          workpointsWithZeroActivity: 0,
          unauthorized: false,
        },
        error: "Unable to load client data.",
      };
    }

    const clientList = (clients ?? []) as Array<{ id: string; status: string }>;
    const totalClients = clientList.length;
    const activeClients = clientList.filter((c) => c.status === "active").length;

    const { data: workpoints, error: workpointsError } = await supabase
      .from("workplaces")
      .select("id, client_id, status")
      .in(
        "client_id",
        clientList.map((c) => c.id),
      );

    if (workpointsError) {
      return {
        data: {
          activeClients,
          totalClients,
          totalWorkpoints: 0,
          activeWorkpoints: 0,
          workpointsUsed: 0,
          workpointsWithZeroActivity: 0,
          unauthorized: false,
        },
        error: "Unable to load workpoint data.",
      };
    }

    const workpointList = (workpoints ?? []) as Array<{
      id: string;
      client_id: string;
      status: string;
    }>;
    const totalWorkpoints = workpointList.length;
    const activeWorkpoints = workpointList.filter((w) => w.status === "active").length;

    let workpointsUsed = 0;
    let workpointsWithZeroActivity = 0;

    if (runId) {
      const { data: entries, error: entriesError } = await supabase
        .from("payroll_work_entries")
        .select("workplace_id")
        .eq("payroll_records.payroll_run_id", runId);

      if (!entriesError && entries) {
        const entriesWithWorkplace = (entries as Array<{
          workplace_id: string | null;
        }>).filter((e) => e.workplace_id != null);

        const usedWorkpointIds = new Set(
          entriesWithWorkplace.map((e) => e.workplace_id as string),
        );
        workpointsUsed = usedWorkpointIds.size;

        const configuredWorkpointIds = new Set(
          workpointList.map((w) => w.id),
        );

        workpointsWithZeroActivity = workpointList.filter(
          (w) => configuredWorkpointIds.has(w.id) && !usedWorkpointIds.has(w.id),
        ).length;
      }
    }

    return {
      data: {
        activeClients,
        totalClients,
        totalWorkpoints,
        activeWorkpoints,
        workpointsUsed,
        workpointsWithZeroActivity,
        unauthorized: false,
      },
      error: null,
    };
  } catch {
    return {
      data: {
        activeClients: 0,
        totalClients: 0,
        totalWorkpoints: 0,
        activeWorkpoints: 0,
        workpointsUsed: 0,
        workpointsWithZeroActivity: 0,
        unauthorized: false,
      },
      error: "Unable to load client and workpoint data.",
    };
  }
}

async function getCurrentPayrollSummary(
  supabase: SupabaseServerClient,
  runId: string | null,
): Promise<import("./types").PayrollSummary> {
  if (!runId) {
    return {
      exists: false,
      grossSalary: 0,
      netSalary: 0,
      runId: null,
      status: null,
      totalDeductions: 0,
      totalShifts: 0,
      unauthorized: false,
      workerCount: 0,
    };
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return {
      exists: false,
      grossSalary: 0,
      netSalary: 0,
      runId: null,
      status: null,
      totalDeductions: 0,
      totalShifts: 0,
      unauthorized: false,
      workerCount: 0,
    };
  }

  const { data: records, error: recordsError } = await supabase
    .from("payroll_records")
    .select("gross_salary, total_deductions, net_salary, payroll_work_entries ( shifts )")
    .eq("payroll_run_id", runId);

  if (recordsError || !records) {
    return {
      exists: true,
      grossSalary: 0,
      netSalary: 0,
      runId: run.id,
      status: run.status as "draft" | "approved",
      totalDeductions: 0,
      totalShifts: 0,
      unauthorized: false,
      workerCount: 0,
    };
  }

  const recordList = records as Array<{
    gross_salary: number | string;
    total_deductions: number | string;
    net_salary: number | string;
    payroll_work_entries: Array<{ shifts: number | string }> | null;
  }>;

  let totalShifts = 0;
  let grossSalary = 0;
  let totalDeductions = 0;
  let netSalary = 0;

  for (const record of recordList) {
    totalShifts += Number(
      (record.payroll_work_entries ?? []).reduce(
        (sum, e) => sum + Number(e.shifts ?? 0),
        0,
      ),
    );
    grossSalary += Number(record.gross_salary ?? 0);
    totalDeductions += Number(record.total_deductions ?? 0);
    netSalary += Number(record.net_salary ?? 0);
  }

  return {
    exists: true,
    grossSalary,
    netSalary,
    runId: run.id,
    status: run.status as "draft" | "approved",
    totalDeductions,
    totalShifts,
    unauthorized: false,
    workerCount: recordList.length,
  };
}

async function getAttentionAlerts(
  supabase: SupabaseServerClient,
  runId: string | null,
  runStatus: "draft" | "approved" | null,
  workpointsWithZeroActivity: number,
  role: string | null,
): Promise<import("./types").AttentionAlert[]> {
  const alerts: import("./types").AttentionAlert[] = [];

  if (!runId) {
    alerts.push({
      description: "Payroll has not been started for the selected period.",
      severity: "warning",
      targetRoute: "/payroll",
      title: "Payroll Not Started",
      type: "no_payroll_run",
    });
    return alerts;
  }

  if (runStatus === "draft") {
    const canApprove = ["owner", "admin"].includes(role ?? "");
    alerts.push({
      count: 1,
      description: canApprove
        ? "Payroll is awaiting final approval."
        : "Payroll is still in draft.",
      severity: "warning",
      targetRoute: "/payroll",
      title: "Payroll In Draft",
      type: "draft_payroll",
    });
  }

  if (workpointsWithZeroActivity > 0) {
    alerts.push({
      count: workpointsWithZeroActivity,
      description: `${workpointsWithZeroActivity} workplace${workpointsWithZeroActivity === 1 ? " has" : "s have"} no work entries this month.`,
      severity: "info",
      title: "Workplaces Need Attention",
      type: "zero_activity_workpoints",
    });
  }

  return alerts;
}

async function getPayrollTrend(
  supabase: SupabaseServerClient,
  selectedYear: number,
  selectedMonth: number,
): Promise<import("./types").PayrollTrendMonth[]> {
  const monthKeys: Array<{ year: number; month: number; label: string }> = [];
  const year = selectedYear;
  const month = selectedMonth;

  for (let i = 5; i >= 0; i--) {
    let lookupYear = year;
    let lookupMonth = month - i;

    while (lookupMonth <= 0) {
      lookupMonth += 12;
      lookupYear -= 1;
    }

    monthKeys.push({
      label: `${months[lookupMonth - 1]} ${lookupYear}`,
      month: lookupMonth,
      year: lookupYear,
    });
  }

  const allRuns = monthKeys.map((mk) => ({ ...mk, exists: false, runId: null as string | null }));

  const minYear = Math.min(...monthKeys.map((mk) => mk.year));
  const maxYear = Math.max(...monthKeys.map((mk) => mk.year));
  const yearRange = new Set(monthKeys.map((mk) => mk.year));

  let runsQuery = supabase
    .from("payroll_runs")
    .select("id, year, month, status")
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (yearRange.size === 1) {
    runsQuery = runsQuery.eq("year", minYear);
  } else {
    runsQuery = runsQuery.gte("year", minYear).lte("year", maxYear);
  }

  const { data: runs, error: runError } = await runsQuery;

  if (runError || !runs) {
    return monthKeys.map((mk) => ({
      deductions: 0,
      exists: false,
      gross: 0,
      label: mk.label,
      month: mk.month,
      net: 0,
      status: null,
      year: mk.year,
    }));
  }

  const runRows = runs as Array<{ id: string; year: number; month: number; status: string }>;
  const runById = new Map(runRows.map((r) => [r.id, r]));

  for (const mk of monthKeys) {
    const matchingRun = runRows.find(
      (r) => r.year === mk.year && r.month === mk.month,
    );

    if (!matchingRun) {
      allRuns.push({
        ...mk,
        exists: false,
        runId: null,
      });
      continue;
    }

    allRuns.push({
      ...mk,
      exists: true,
      runId: matchingRun.id,
    });
  }

  const relevantRunIds = allRuns.filter((r) => r.runId).map((r) => r.runId as string);

  const recordsByRunId = new Map<string, Array<{
    gross_salary: number | string;
    total_deductions: number | string;
    net_salary: number | string;
  }>>();

  if (relevantRunIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from("payroll_records")
      .select("gross_salary, net_salary, payroll_run_id, total_deductions")
      .in("payroll_run_id", relevantRunIds);

    if (!recordsError && records) {
      const recordList = records as Array<{
        gross_salary: number | string;
        net_salary: number | string;
        payroll_run_id: string;
        total_deductions: number | string;
      }>;

      for (const record of recordList) {
        const runRecords = recordsByRunId.get(record.payroll_run_id) ?? [];
        runRecords.push(record);
        recordsByRunId.set(record.payroll_run_id, runRecords);
      }
    }
  }

  return allRuns.map((runInfo) => {
    if (!runInfo.runId) {
      return {
        deductions: 0,
        exists: false,
        gross: 0,
        label: runInfo.label,
        month: runInfo.month,
        net: 0,
        status: null,
        year: runInfo.year,
      };
    }

    const run = runById.get(runInfo.runId);
    const runRecords = recordsByRunId.get(runInfo.runId) ?? [];

    let gross = 0;
    let deductions = 0;
    let net = 0;

    for (const record of runRecords) {
      gross += Number(record.gross_salary ?? 0);
      deductions += Number(record.total_deductions ?? 0);
      net += Number(record.net_salary ?? 0);
    }

    return {
      deductions,
      exists: true,
      gross,
      label: runInfo.label,
      month: runInfo.month,
      net,
      status: (run?.status as "draft" | "approved") ?? null,
      year: runInfo.year,
    };
  });
}

async function getClientContributions(
  supabase: SupabaseServerClient,
  runId: string | null,
): Promise<import("./types").ClientContribution[]> {
  if (!runId) {
    return [];
  }

  const { data: entries, error } = await supabase
    .from("payroll_work_entries")
    .select(`
      line_gross,
      shifts,
      workplace_id,
      workplaces (
        id,
        client_id,
        clients (
          id,
          client_code,
          name
        )
      ),
      payroll_records!inner (
        worker_id,
        workers!inner (
          id
        )
      )
    `)
    .eq("payroll_records.payroll_run_id", runId);

  if (error || !entries) {
    return [];
  }

  type EntryRow = {
    line_gross: number | string | null;
    shifts: number | string | null;
    workplace_id: string | null;
    workplaces: {
      id: string | null;
      client_id: string | null;
      clients: { id: string; client_code: string; name: string } | null;
    } | null;
    payroll_records: {
      worker_id: string;
      workers: { id: string } | null;
    } | null;
  };

  const entryRows = entries as unknown as EntryRow[];
  const clientMap = new Map<
    string,
    {
      clientCode: string;
      clientId: string;
      clientName: string;
      contribution: number;
      shifts: number;
      workerSet: Set<string>;
      workpointSet: Set<string>;
    }
  >();

  for (const entry of entryRows) {
    const contribution = Number(entry.line_gross ?? 0);
    const shifts = Number(entry.shifts ?? 0);
    const wp = entry.workplaces;
    const client = wp?.clients ?? null;

    if (!client?.id) {
      continue;
    }

    let clientData = clientMap.get(client.id);

    if (!clientData) {
      clientData = {
        clientCode: client.client_code ?? "",
        clientId: client.id,
        clientName: client.name ?? "",
        contribution: 0,
        shifts: 0,
        workerSet: new Set(),
        workpointSet: new Set(),
      };
      clientMap.set(client.id, clientData);
    }

    clientData.contribution += contribution;
    clientData.shifts += shifts;

    const record = Array.isArray(entry.payroll_records)
      ? entry.payroll_records[0]
      : entry.payroll_records;

    if (record?.worker_id) {
      clientData.workerSet.add(record.worker_id);
    }

    if (entry.workplace_id) {
      clientData.workpointSet.add(entry.workplace_id);
    }
  }

  return Array.from(clientMap.values())
    .map((c) => ({
      clientCode: c.clientCode,
      clientId: c.clientId,
      clientName: c.clientName,
      contribution: c.contribution,
      shifts: c.shifts,
      uniqueWorkers: c.workerSet.size,
      workpointsUsed: c.workpointSet.size,
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);
}

async function getRecentUpdates(
  supabase: SupabaseServerClient,
  periodStart: string,
): Promise<import("./types").RecentUpdate[]> {
  const updates: import("./types").RecentUpdate[] = [];

  const { data: recentHistory, error: historyError } = await supabase
    .from("worker_status_history")
    .select("id, new_status, effective_date, reason, created_at, workers ( full_name )")
    .gte("effective_date", periodStart)
    .order("effective_date", { ascending: false })
    .limit(5);

  if (!historyError && recentHistory) {
    const historyRows = recentHistory as unknown as Array<{
      id: string;
      new_status: string;
      effective_date: string;
      reason: string | null;
      created_at: string;
      workers: { full_name: string } | { full_name: string }[] | null;
    }>;

    for (const event of historyRows) {
      const worker = Array.isArray(event.workers)
        ? event.workers[0]
        : event.workers;

      updates.push({
        description: event.reason ?? `Status changed to ${event.new_status}`,
        id: event.id,
        label: worker?.full_name ?? "Unknown worker",
        timestamp: event.created_at,
        type: "worker_status_change",
      });
    }
  }

  const { data: recentRuns, error: runsError } = await supabase
    .from("payroll_runs")
    .select("id, year, month, status, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  if (!runsError && recentRuns) {
    const runRows = recentRuns as Array<{
      id: string;
      year: number;
      month: number;
      status: string;
      created_at: string;
    }>;

    for (const run of runRows) {
      updates.push({
        description: `Payroll run for ${months[run.month - 1]} ${run.year} (${run.status})`,
        id: run.id,
        label: "Payroll Run",
        targetRoute: `/reports/monthly-payroll?year=${run.year}&month=${run.month}`,
        timestamp: run.created_at,
        type: "payroll_run",
      });
    }
  }

  updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return updates.slice(0, 10);
}

export async function getDashboardData(params: {
  month?: number;
  year?: number;
}): Promise<import("./types").DashboardResult> {
  const supabase = await createClient();
  const role = (await getCurrentRole(supabase)) ?? "unknown";
  const { month, year } = normalizePeriod(
    readPeriod(String(params.year), new Date().getFullYear()),
    readPeriod(String(params.month), new Date().getMonth() + 1),
  );

  const periodStart = getPeriodStart(year, month);
  const periodEnd = getPeriodEnd(year, month);
  const authorized = hasDashboardAccess(role);

  const errors: import("./types").DashboardError[] = [];

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (runError) {
    errors.push({ message: "Unable to load payroll run.", section: "payroll" });
  }

  const runId = run?.id ?? null;
  const runStatus = (run?.status as "draft" | "approved" | null) ?? null;

  const unauthorizedMetrics = (): import("./types").WorkforceMetrics => ({
    activePermanentWorkers: 0,
    inactivePermanentWorkers: 0,
    periodRelevantPermanentWorkers: 0,
    resignedThisMonth: 0,
    terminatedThisMonth: 0,
    temporaryWorkersUsed: 0,
    totalPermanentWorkers: 0,
    unauthorized: true,
  });

  const unauthorizedClients = (): import("./types").ClientWorkpointMetrics => ({
    activeClients: 0,
    totalClients: 0,
    totalWorkpoints: 0,
    activeWorkpoints: 0,
    workpointsUsed: 0,
    workpointsWithZeroActivity: 0,
    unauthorized: true,
  });

  const unauthorizedPayroll = (): import("./types").PayrollSummary => ({
    exists: false,
    grossSalary: 0,
    netSalary: 0,
    runId: null,
    status: null,
    totalDeductions: 0,
    totalShifts: 0,
    unauthorized: true,
    workerCount: 0,
  });

  const [workforceResult, clientWorkpointResult] = await Promise.all([
    authorized
      ? getWorkforceMetrics(supabase, periodStart, periodEnd)
      : Promise.resolve({ data: unauthorizedMetrics(), error: null }),
    authorized
      ? getClientWorkpointMetrics(supabase, runId)
      : Promise.resolve({ data: unauthorizedClients(), error: null }),
  ]);

  if (workforceResult.error) {
    errors.push({ message: workforceResult.error, section: "workforce" });
  }

  if (clientWorkpointResult.error) {
    errors.push({ message: clientWorkpointResult.error, section: "clients" });
  }

  let payrollSummary: import("./types").PayrollSummary;
  let alerts: import("./types").AttentionAlert[] = [];
  let trend: import("./types").PayrollTrendMonth[] = [];
  let topClients: import("./types").ClientContribution[] = [];
  let recentUpdates: import("./types").RecentUpdate[] = [];

  if (authorized) {
    const [payrollResult, trendResult, clientResult, alertsResult, updatesResult] =
      await Promise.all([
        Promise.resolve(getCurrentPayrollSummary(supabase, runId)),
        getPayrollTrend(supabase, year, month),
        getClientContributions(supabase, runId),
        getAttentionAlerts(
          supabase,
          runId,
          runStatus,
          clientWorkpointResult.data.workpointsWithZeroActivity,
          role,
        ),
        getRecentUpdates(supabase, periodStart),
      ]);

    payrollSummary = payrollResult;
    trend = trendResult;
    topClients = clientResult;
    alerts = alertsResult;
    recentUpdates = updatesResult;

    if (runId) {
      const temporaryCount = await getTemporaryWorkersUsed(supabase, runId);
      workforceResult.data.temporaryWorkersUsed = temporaryCount;
    }
  } else {
    payrollSummary = unauthorizedPayroll();
  }

  return {
    data: {
      alerts,
      clientsWorkpoints: clientWorkpointResult.data,
      payroll: payrollSummary,
      recentUpdates,
      role,
      topClients,
      trend,
      workforce: workforceResult.data,
      periodLabel: `${months[month - 1]} ${year}`,
    },
    errors,
  };
}
