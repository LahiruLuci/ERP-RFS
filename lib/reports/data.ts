import "server-only";

import type {
    WorkerDeductionStatus,
    WorkerDeductionType,
} from "@/lib/deductions/types";
import { getPayrollPeriodData } from "@/lib/payroll/data";
import { createClient } from "@/lib/supabase/server";

export class ReportPermissionError extends Error {
    constructor() {
        super("Current user is not allowed to view reports.");
        this.name = "ReportPermissionError";
    }
}

async function assertReportAccess(
    supabase: Awaited<ReturnType<typeof createClient>>,
) {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new ReportPermissionError();
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile || profile.is_active !== true) {
        throw new ReportPermissionError();
    }

    const role = String(profile.role);
    if (!["owner", "admin", "accounts"].includes(role)) {
        throw new ReportPermissionError();
    }

    return { role, user };
}

export async function getMonthlyPayrollReport({
    month,
    search = "",
    year,
}: {
    month: number;
    search?: string;
    year: number;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    // Get the payroll run for this period
    const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .select("id, year, month, status")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

    if (runError) {
        throw new Error("Unable to load payroll run.");
    }

    if (!run?.id) {
        return {
            run: null,
            rows: [],
            totals: { workers: 0, shifts: 0, gross: 0, deductions: 0, net: 0 },
        };
    }

    // Fetch ALL payroll records for this run.
    let query = supabase
        .from("payroll_records")
        .select(`
      id,
      worker_id,
      gross_salary,
      advance,
      advance_override,
      epf,
      meals,
      meals_override,
      uniform,
      uniform_override,
      other_deduction,
      other_deduction_override,
      other_note,
      total_deductions,
      net_salary,
      payroll_work_entries (
        shifts,
        workplace_name
      ),
      workers!inner (
        id,
        employee_no,
        worker_type,
        full_name,
        nic,
        etf_no
      )
    `)
        .eq("payroll_run_id", run.id)
        .order("created_at", { ascending: false });

    if (search.trim()) {
        const pattern = `%${search.replace(/[%,()]/g, " ").trim()}%`;
        query = query.or(
            `full_name.ilike.${pattern},employee_no.ilike.${pattern},nic.ilike.${pattern},etf_no.ilike.${pattern}`,
            { foreignTable: "workers" }
        );
    }

    const { data: recordsData, error: recordsError } = await query;

    if (recordsError) {
        throw new Error("Unable to load payroll records.");
    }

    const records = recordsData ?? [];
    let totalWorkers = 0;
    let totalShifts = 0;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    type WorkerType = { id: string; employee_no: string; full_name: string; worker_type: string; nic: string | null; etf_no: string | null };
    type EntryType = { shifts: string | number; workplace_name: string };

    const rows = records.map((record) => {
        const worker = Array.isArray(record.workers) ? (record.workers[0] as unknown as WorkerType) : (record.workers as unknown as WorkerType);
        const entries = (record.payroll_work_entries ?? []) as EntryType[];
        const shiftsSum = entries.reduce((sum, e) => sum + Number(e.shifts ?? 0), 0);
        const gross = Number(record.gross_salary ?? 0);
        const deductions = Number(record.total_deductions ?? 0);
        const net = Number(record.net_salary ?? 0);

        // Aggregate for summary
        totalWorkers += 1;
        totalShifts += shiftsSum;
        totalGross += gross;
        totalDeductions += deductions;
        totalNet += net;

        return {
            worker,
            record: {
                id: record.id,
                gross: gross,
                deductions: deductions,
                net: net,
                workplaces: entries.slice(0, 2).map((e) => `${e.workplace_name} (${e.shifts})`).join(", ") || "Not entered",
            },
            shifts: shiftsSum,
        };
    });

    return {
        run: { status: run.status },
        rows,
        totals: {
            workers: totalWorkers,
            shifts: totalShifts,
            gross: totalGross,
            deductions: totalDeductions,
            net: totalNet,
        },
    };
}

export async function searchWorkersForReport(search: string) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    if (!search.trim()) {
        return [];
    }

    const pattern = `%${search.replace(/[%,()]/g, " ").trim()}%`;

    const { data, error } = await supabase
        .from("workers")
        .select("id, employee_no, full_name, nic, etf_no, worker_type, status")
        .or(`full_name.ilike.${pattern},employee_no.ilike.${pattern},nic.ilike.${pattern},etf_no.ilike.${pattern}`)
        .order("employee_no", { ascending: true })
        .limit(5);

    if (error) {
        throw new Error("Unable to search workers.");
    }

    return data ?? [];
}

export async function getWorkerSalaryReportWorkers({
    month,
    search = "",
    year,
}: {
    month: number;
    search?: string;
    year: number;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    const payrollData = await getPayrollPeriodData({ month, search, year });

    return payrollData.rows
        .filter(({ record, worker }) => worker.worker_type !== "temporary" || record)
        .map(({ record, worker }) => {
            const entries = record?.payroll_work_entries ?? [];
            const shifts = entries.reduce(
                (sum, entry) => sum + Number(entry.shifts ?? 0),
                0,
            );

            return {
                employee_no: worker.employee_no,
                full_name: worker.full_name,
                gross: Number(record?.gross_salary ?? 0),
                id: worker.id,
                net: Number(record?.net_salary ?? 0),
                payrollStatus: record ? "Prepared" : "Not prepared",
                shifts,
                status: worker.status,
                worker_type: worker.worker_type,
            };
        });
}

export async function getWorkerSalaryReport({
    workerId,
    startYear,
    startMonth,
    endYear,
    endMonth,
}: {
    workerId: string;
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    // Load worker details
    const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("id, employee_no, full_name, nic, etf_no, worker_type, status")
        .eq("id", workerId)
        .maybeSingle();

    if (workerError || !worker) {
        throw new Error("Unable to load worker.");
    }

    // Load payroll history for the worker across range
    const { data: recordsData, error: recordsError } = await supabase
        .from("payroll_records")
        .select(`
      id,
      gross_salary,
      total_deductions,
      net_salary,
      payroll_work_entries ( shifts ),
      payroll_runs!inner ( year, month, status )
    `)
        .eq("worker_id", workerId)
        .gte("payroll_runs.year", startYear)
        .lte("payroll_runs.year", endYear);

    if (recordsError) {
        throw new Error("Unable to load salary history.");
    }

    // Filter precisely by start/end month (year check is done, but we need exact month range)
    const validRecords = (recordsData ?? []).filter((r) => {
        // Note: since payroll_runs is !inner it will come as an object or array. Usually object.
        const run = Array.isArray(r.payroll_runs) ? r.payroll_runs[0] : r.payroll_runs;
        if (!run) return false;

        // Convert to absolute months for easy comparison: (Year * 12) + Month
        const runAbs = (run.year * 12) + run.month;
        const startAbs = (startYear * 12) + startMonth;
        const endAbs = (endYear * 12) + endMonth;

        return runAbs >= startAbs && runAbs <= endAbs;
    });

    // Sort from chronologically latest to oldest
    validRecords.sort((a, b) => {
        const runA = Array.isArray(a.payroll_runs) ? a.payroll_runs[0] : a.payroll_runs;
        const runB = Array.isArray(b.payroll_runs) ? b.payroll_runs[0] : b.payroll_runs;
        const absA = runA ? (runA.year * 12) + runA.month : 0;
        const absB = runB ? (runB.year * 12) + runB.month : 0;
        return absB - absA;
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalShifts = 0;
    let totalMonths = 0;

    type EntryType = { shifts: string | number };

    const rows = validRecords.map((record) => {
        const entries = (record.payroll_work_entries ?? []) as EntryType[];
        const shiftsSum = entries.reduce((sum, e) => sum + Number(e.shifts ?? 0), 0);
        const gross = Number(record.gross_salary ?? 0);
        const deductions = Number(record.total_deductions ?? 0);
        const net = Number(record.net_salary ?? 0);
        const run = Array.isArray(record.payroll_runs) ? record.payroll_runs[0] : record.payroll_runs;

        totalMonths += 1;
        totalShifts += shiftsSum;
        totalGross += gross;
        totalDeductions += deductions;
        totalNet += net;

        return {
            record: {
                id: record.id,
                gross: gross,
                deductions: deductions,
                net: net,
            },
            shifts: shiftsSum,
            run: {
                year: run?.year ?? 0,
                month: run?.month ?? 0,
                status: run?.status ?? "draft",
            }
        };
    });

    return {
        worker,
        rows,
        totals: {
            months: totalMonths,
            shifts: totalShifts,
            gross: totalGross,
            deductions: totalDeductions,
            net: totalNet,
        },
    };
}

function getPayrollConsistencyWarnings({
    deductionTotal,
    grossFromEntries,
    recordGross,
    recordNet,
    recordTotalDeductions,
}: {
    deductionTotal: number;
    grossFromEntries: number;
    recordGross: number;
    recordNet: number;
    recordTotalDeductions: number;
}) {
    const warnings: string[] = [];
    const tolerance = 0.01;

    if (Math.abs(grossFromEntries - recordGross) > tolerance) {
        warnings.push(
            "Saved gross salary does not match the saved work-entry total.",
        );
    }

    if (Math.abs(deductionTotal - recordTotalDeductions) > tolerance) {
        warnings.push(
            "Saved total deductions do not match the saved deduction breakdown.",
        );
    }

    if (Math.abs(recordGross - recordTotalDeductions - recordNet) > tolerance) {
        warnings.push(
            "Saved net salary does not match saved gross salary minus saved deductions.",
        );
    }

    return warnings;
}

export async function getWorkerPayslipReport({
    month,
    workerId,
    year,
}: {
    month: number;
    workerId: string;
    year: number;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    if (!workerId.trim()) {
        throw new Error("Worker is required.");
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error("Choose a valid payroll year.");
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error("Choose a valid payroll month.");
    }

    const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("id, employee_no, full_name, nic, etf_no, worker_type, status")
        .eq("id", workerId)
        .maybeSingle();

    if (workerError) {
        throw new Error("Unable to load worker.");
    }

    if (!worker) {
        return {
            issue: "worker-not-found" as const,
            record: null,
            run: null,
            worker: null,
        };
    }

    const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .select("id, year, month, status")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

    if (runError) {
        throw new Error("Unable to load payroll run.");
    }

    if (!run?.id) {
        return {
            issue: "payroll-record-not-found" as const,
            record: null,
            run: null,
            worker,
        };
    }

    const { data: recordData, error: recordError } = await supabase
        .from("payroll_records")
        .select(`
            id,
            gross_salary,
            advance,
            epf,
            meals,
            uniform,
            other_deduction,
            other_note,
            total_deductions,
            net_salary,
            payroll_work_entries (
                id,
                workplace_name,
                shifts,
                shift_rate,
                line_gross
            )
        `)
        .eq("payroll_run_id", run.id)
        .eq("worker_id", workerId)
        .maybeSingle();

    if (recordError) {
        throw new Error("Unable to load payroll record.");
    }

    if (!recordData) {
        return {
            issue: "payroll-record-not-found" as const,
            record: null,
            run,
            worker,
        };
    }

    type PayslipWorkEntry = {
        id: string;
        line_gross: number | string | null;
        shift_rate: number | string | null;
        shifts: number | string | null;
        workplace_name: string | null;
    };

    const entryMap = new Map<
        string,
        {
            amount: number;
            id: string;
            rate: number;
            shifts: number;
            workplaceName: string;
        }
    >();

    for (const entry of (recordData.payroll_work_entries ?? []) as PayslipWorkEntry[]) {
        const workplaceName = entry.workplace_name ?? "Not specified";
        const rate = Number(entry.shift_rate ?? 0);
        const key = `${workplaceName}::${rate}`;
        const existing = entryMap.get(key);

        if (existing) {
            existing.amount += Number(entry.line_gross ?? 0);
            existing.shifts += Number(entry.shifts ?? 0);
        } else {
            entryMap.set(key, {
                amount: Number(entry.line_gross ?? 0),
                id: entry.id,
                rate,
                shifts: Number(entry.shifts ?? 0),
                workplaceName,
            });
        }
    }

    const entries = Array.from(entryMap.values()).sort((a, b) =>
        a.workplaceName.localeCompare(b.workplaceName),
    );

    const record = {
        advance: Number(recordData.advance ?? 0),
        epf: Number(recordData.epf ?? 0),
        grossSalary: Number(recordData.gross_salary ?? 0),
        id: recordData.id,
        meals: Number(recordData.meals ?? 0),
        netSalary: Number(recordData.net_salary ?? 0),
        otherDeduction: Number(recordData.other_deduction ?? 0),
        otherNote: recordData.other_note,
        totalDeductions: Number(recordData.total_deductions ?? 0),
        uniform: Number(recordData.uniform ?? 0),
        workEntries: entries,
    };
    const grossFromEntries = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalShifts = entries.reduce((sum, entry) => sum + entry.shifts, 0);
    const deductionTotal =
        record.advance +
        record.epf +
        record.meals +
        record.uniform +
        record.otherDeduction;

    return {
        consistencyWarnings: getPayrollConsistencyWarnings({
            deductionTotal,
            grossFromEntries,
            recordGross: record.grossSalary,
            recordNet: record.netSalary,
            recordTotalDeductions: record.totalDeductions,
        }),
        issue: null,
        record,
        run,
        totals: {
            deductionBreakdownTotal: deductionTotal,
            grossFromEntries,
            totalShifts,
        },
        worker,
    };
}

export async function getClientsForReportSelect() {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    const { data, error } = await supabase
        .from("clients")
        .select("id, name, client_code")
        .order("name", { ascending: true });

    if (error) {
        throw new Error("Unable to load clients.");
    }

    return data ?? [];
}

export async function getWorkpointsForReportSelect({
    clientId = "all",
}: {
    clientId?: string;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    let query = supabase
        .from("workplaces")
        .select("id, name, workplace_code, client_id")
        .order("name", { ascending: true });

    if (clientId && clientId !== "all") {
        query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error("Unable to load workpoints.");
    }

    return data ?? [];
}

export async function getClientCostReport({
    month,
    year,
    clientId = "",
    workpointId = "",
}: {
    month: number;
    year: number;
    clientId?: string;
    workpointId?: string;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    // 1. Get Payroll Run
    const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .select("id, year, month, status")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

    if (runError) {
        throw new Error("Unable to load payroll run.");
    }

    if (!run?.id) {
        return {
            run: null,
            clients: [],
            totals: { clients: 0, workpoints: 0, workers: 0, shifts: 0, cost: 0 },
        };
    }

    let query = supabase
        .from("payroll_work_entries")
        .select(`
            id,
            workplace_id,
            shifts,
            shift_rate,
            line_gross,
            workplace_name,
            workplaces (
                id,
                name,
                workplace_code,
                client_id,
                clients (
                    id,
                    name,
                    client_code
                )
            ),
            payroll_records!inner (
                payroll_run_id,
                workers!inner (
                    id,
                    full_name,
                    worker_type,
                    employee_no
                )
            )
        `)
        .eq("payroll_records.payroll_run_id", run.id);

    if (workpointId && workpointId !== "all") {
        query = query.eq("workplace_id", workpointId);
    }

    const { data: entriesData, error: entriesError } = await query;

    if (entriesError) {
        throw new Error("Unable to load work entries.");
    }

    const UNASSIGNED_CLIENT_ID = "unassigned-client";
    const UNASSIGNED_WORKPOINT_ID = "unassigned-workpoint";

    type ReportClient = {
        id: string;
        name: string | null;
        client_code: string | null;
    };

    type ReportWorkplace = {
        id: string;
        name: string | null;
        workplace_code: string | null;
        client_id: string | null;
        clients: ReportClient | ReportClient[] | null;
    };

    type ReportWorker = {
        id: string;
        full_name: string | null;
        worker_type: string | null;
        employee_no: string | null;
    };

    type ReportRecord = {
        payroll_run_id: string;
        workers: ReportWorker | ReportWorker[] | null;
    };

    type ReportEntry = {
        id: string;
        workplace_id: string | null;
        shifts: number | string | null;
        shift_rate: number | string | null;
        line_gross: number | string | null;
        workplace_name: string | null;
        workplaces: ReportWorkplace | ReportWorkplace[] | null;
        payroll_records: ReportRecord | ReportRecord[] | null;
    };

    type ClientAggr = {
        id: string;
        name: string;
        code: string;
        shifts: number;
        cost: number;
        workerSet: Set<string>;
        workpoints: Map<string, WorkpointAggr>;
    };

    type WorkpointAggr = {
        id: string;
        name: string;
        code: string;
        shifts: number;
        cost: number;
        workerSet: Set<string>;
        workerContributions: Map<string, WorkerContributionAggr>;
    };

    type WorkerContributionAggr = {
        workerId: string;
        name: string;
        employeeNo: string;
        type: string;
        shifts: number;
        cost: number;
        rateSet: Set<number>;
    };

    function firstOrValue<T>(value: T | T[] | null | undefined) {
        return Array.isArray(value) ? value[0] : value;
    }

    const clientMap = new Map<string, ClientAggr>();
    const globalWorkerSet = new Set<string>();
    let grandTotalShifts = 0;
    let grandTotalCost = 0;

    const entries = (entriesData ?? []) as unknown as ReportEntry[];

    for (const entry of entries) {
        const shifts = Number(entry.shifts ?? 0);
        const cost = Number(entry.line_gross ?? 0);
        const rate = Number(entry.shift_rate ?? 0);
        const record = firstOrValue(entry.payroll_records);
        const worker = firstOrValue(record?.workers);

        if (!worker?.id) {
            continue;
        }

        let cId = UNASSIGNED_CLIENT_ID;
        let cName = "Unassigned / Unattributed";
        let cCode = "N/A";
        let wpId = entry.workplace_id ?? UNASSIGNED_WORKPOINT_ID;
        const wpName = entry.workplace_name || "General / Unassigned";
        let wpCode = "N/A";

        const wp = firstOrValue(entry.workplaces);
        if (wp) {
            wpId = wp.id;
            wpCode = wp.workplace_code ?? "N/A";

            const cl = firstOrValue(wp.clients);
            if (cl) {
                cId = cl.id;
                cName = cl.name ?? "Unknown Client";
                cCode = cl.client_code ?? "N/A";
            }
        }

        if (clientId && clientId !== "all" && cId !== clientId) {
            continue;
        }

        if (!clientMap.has(cId)) {
            clientMap.set(cId, {
                id: cId,
                name: cName,
                code: cCode,
                shifts: 0,
                cost: 0,
                workerSet: new Set(),
                workpoints: new Map(),
            });
        }
        const clientAggr = clientMap.get(cId)!;

        if (!clientAggr.workpoints.has(wpId)) {
            clientAggr.workpoints.set(wpId, {
                id: wpId,
                name: wpName,
                code: wpCode,
                shifts: 0,
                cost: 0,
                workerSet: new Set(),
                workerContributions: new Map(),
            });
        }
        const wpAggr = clientAggr.workpoints.get(wpId)!;

        if (!wpAggr.workerContributions.has(worker.id)) {
            wpAggr.workerContributions.set(worker.id, {
                workerId: worker.id,
                name: worker.full_name ?? "Unknown Worker",
                employeeNo: worker.employee_no ?? "N/A",
                type: worker.worker_type ?? "permanent",
                shifts: 0,
                cost: 0,
                rateSet: new Set(),
            });
        }
        const wcAggr = wpAggr.workerContributions.get(worker.id)!;

        clientAggr.shifts += shifts;
        clientAggr.cost += cost;
        clientAggr.workerSet.add(worker.id);

        wpAggr.shifts += shifts;
        wpAggr.cost += cost;
        wpAggr.workerSet.add(worker.id);

        wcAggr.shifts += shifts;
        wcAggr.cost += cost;
        wcAggr.rateSet.add(rate);

        globalWorkerSet.add(worker.id);
        grandTotalShifts += shifts;
        grandTotalCost += cost;
    }

    const outputClients = Array.from(clientMap.values()).map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        shifts: c.shifts,
        cost: c.cost,
        uniqueWorkers: c.workerSet.size,
        workpoints: Array.from(c.workpoints.values()).map(wp => ({
            id: wp.id,
            name: wp.name,
            code: wp.code,
            shifts: wp.shifts,
            cost: wp.cost,
            uniqueWorkers: wp.workerSet.size,
            workerContributions: Array.from(wp.workerContributions.values()).sort((a, b) => a.name.localeCompare(b.name)).map(wc => ({
                workerId: wc.workerId,
                name: wc.name,
                employeeNo: wc.employeeNo,
                type: wc.type,
                shifts: wc.shifts,
                cost: wc.cost,
                rates: Array.from(wc.rateSet).sort((a, b) => a - b),
            }))
        })).sort((a, b) => b.cost - a.cost)
    })).sort((a, b) => b.cost - a.cost);

    let totalWorkpoints = 0;
    for (const c of clientMap.values()) {
        totalWorkpoints += c.workpoints.size;
    }

    return {
        run: { status: run.status },
        clients: outputClients,
        totals: {
            clients: outputClients.length,
            workpoints: totalWorkpoints,
            workers: globalWorkerSet.size,
            shifts: grandTotalShifts,
            cost: grandTotalCost,
        }
    };
}

type DeductionReportStatusFilter = "active" | "cancelled" | "all";

function getMonthBounds(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(year, month, 1));
    const end = `${endDate.getUTCFullYear()}-${String(
        endDate.getUTCMonth() + 1,
    ).padStart(2, "0")}-01`;

    return { end, start };
}

function firstOrValue<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function emptyDeductionTotals() {
    return {
        advance: 0,
        meals: 0,
        other: 0,
        total: 0,
        uniform: 0,
    };
}

export async function getAdvancesDeductionsReport({
    month,
    search = "",
    status = "active",
    type = "all",
    year,
}: {
    month: number;
    search?: string;
    status?: DeductionReportStatusFilter;
    type?: WorkerDeductionType | "all";
    year: number;
}) {
    const supabase = await createClient();
    await assertReportAccess(supabase);

    const { end, start } = getMonthBounds(year, month);

    let query = supabase
        .from("worker_deductions")
        .select(`
            id,
            type,
            amount,
            transaction_date,
            note,
            status,
            payroll_record_id,
            cancellation_reason,
            cancelled_at,
            created_at,
            created_by_profile:profiles!worker_deductions_created_by_fkey(full_name),
            workers!inner (
                id,
                employee_no,
                full_name,
                worker_type,
                status,
                nic,
                etf_no
            )
        `)
        .gte("transaction_date", start)
        .lt("transaction_date", end)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (type !== "all") {
        query = query.eq("type", type);
    }

    if (status !== "all") {
        query = query.eq("status", status);
    }

    const searchTerm = search.replace(/[%,()]/g, " ").trim();
    if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        query = query.or(
            `full_name.ilike.${pattern},employee_no.ilike.${pattern},nic.ilike.${pattern},etf_no.ilike.${pattern}`,
            { foreignTable: "workers" },
        );
    }

    const { data, error } = await query;

    if (error) {
        throw new Error("Unable to load advances and deductions report.");
    }

    type ReportWorker = {
        employee_no: string | null;
        etf_no: string | null;
        full_name: string | null;
        id: string;
        nic: string | null;
        status: string | null;
        worker_type: string | null;
    };

    type ReportProfile = {
        full_name: string | null;
    };

    type ReportDeduction = {
        amount: number | string | null;
        cancellation_reason: string | null;
        cancelled_at: string | null;
        created_at: string;
        created_by_profile: ReportProfile | ReportProfile[] | null;
        id: string;
        note: string | null;
        payroll_record_id: string | null;
        status: WorkerDeductionStatus;
        transaction_date: string;
        type: WorkerDeductionType;
        workers: ReportWorker | ReportWorker[] | null;
    };

    type WorkerSummaryAggregate = {
        employeeNo: string;
        id: string;
        name: string;
        status: string;
        totals: ReturnType<typeof emptyDeductionTotals>;
        transactionCount: number;
        type: string;
    };

    const activeTotals = emptyDeductionTotals();
    let cancelledAmount = 0;
    const workerSummaryMap = new Map<string, WorkerSummaryAggregate>();
    const uniqueWorkerSet = new Set<string>();

    const transactions = ((data ?? []) as unknown as ReportDeduction[])
        .map((deduction) => {
            const worker = firstOrValue(deduction.workers);
            const createdByProfile = firstOrValue(deduction.created_by_profile);
            const amount = Number(deduction.amount ?? 0);

            if (!worker?.id || !Number.isFinite(amount)) {
                return null;
            }

            uniqueWorkerSet.add(worker.id);

            if (deduction.status === "active") {
                activeTotals[deduction.type] += amount;
            } else {
                cancelledAmount += amount;
            }

            if (!workerSummaryMap.has(worker.id)) {
                workerSummaryMap.set(worker.id, {
                    employeeNo: worker.employee_no ?? "N/A",
                    id: worker.id,
                    name: worker.full_name ?? "Unknown Worker",
                    status: worker.status ?? "unknown",
                    totals: emptyDeductionTotals(),
                    transactionCount: 0,
                    type: worker.worker_type ?? "permanent",
                });
            }

            const workerSummary = workerSummaryMap.get(worker.id)!;
            workerSummary.transactionCount += 1;

            if (deduction.status === "active") {
                workerSummary.totals[deduction.type] += amount;
            }

            return {
                amount,
                cancellationReason: deduction.cancellation_reason,
                cancelledAt: deduction.cancelled_at,
                createdAt: deduction.created_at,
                createdBy: createdByProfile?.full_name ?? "Internal user",
                id: deduction.id,
                isPayrollLinked: Boolean(deduction.payroll_record_id),
                note: deduction.note,
                status: deduction.status,
                transactionDate: deduction.transaction_date,
                type: deduction.type,
                worker: {
                    employeeNo: worker.employee_no ?? "N/A",
                    id: worker.id,
                    name: worker.full_name ?? "Unknown Worker",
                    status: worker.status ?? "unknown",
                    type: worker.worker_type ?? "permanent",
                },
            };
        })
        .filter((transaction): transaction is NonNullable<typeof transaction> =>
            transaction !== null
        );

    activeTotals.total =
        activeTotals.advance +
        activeTotals.meals +
        activeTotals.uniform +
        activeTotals.other;

    const workerSummaries = Array.from(workerSummaryMap.values())
        .map((worker) => {
            worker.totals.total =
                worker.totals.advance +
                worker.totals.meals +
                worker.totals.uniform +
                worker.totals.other;

            return worker;
        })
        .sort((a, b) => b.totals.total - a.totals.total || a.name.localeCompare(b.name));

    return {
        totals: {
            ...activeTotals,
            cancelledAmount,
            transactions: transactions.length,
            workers: uniqueWorkerSet.size,
        },
        transactions,
        workerSummaries,
    };
}
