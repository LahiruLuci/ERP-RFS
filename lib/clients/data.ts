import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PayrollWorker } from "@/lib/payroll/types";
import {
  getPayrollEligibleWorkers,
  getPayrollPeriod,
  PayrollApprovedError,
  PayrollValidationError,
} from "@/lib/payroll/data";

import type {
  Client,
  ClientInput,
  ClientStatus,
  ClientWithWorkpointCount,
  ClientWorkpointSummary,
  ClientWorkpointWorkerSummary,
  Workpoint,
  WorkpointInput,
  WorkpointPayrollEntry,
  WorkpointPayrollSaveInput,
  WorkpointPayrollSummary,
} from "./types";

const clientSelect = `
  id,
  client_code,
  name,
  contact_person,
  phone,
  email,
  billing_address,
  status,
  notes,
  created_at,
  updated_at
`;

const workpointSelect = `
  id,
  workplace_code,
  client_id,
  name,
  address,
  contact_person,
  contact_phone,
  default_day_rate,
  default_night_rate,
  required_guards,
  status,
  notes,
  created_at,
  updated_at
`;

export class ClientAuthenticationError extends Error {
  constructor() {
    super("Current user is not authenticated.");
    this.name = "ClientAuthenticationError";
  }
}

export class ClientConnectionError extends Error {
  constructor() {
    super("Unable to connect to Supabase.");
    this.name = "ClientConnectionError";
  }
}

export class ClientPermissionError extends Error {
  constructor() {
    super("Current user is not allowed to manage clients.");
    this.name = "ClientPermissionError";
  }
}

export class ClientValidationError extends Error {
  constructor(message = "Client values are invalid.") {
    super(message);
    this.name = "ClientValidationError";
  }
}

export class ClientDatabaseSetupError extends Error {
  constructor() {
    super("Client database setup is not complete.");
    this.name = "ClientDatabaseSetupError";
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRole = "owner" | "admin" | "accounts" | string;

function sanitizeSearchTerm(search: string) {
  return search.replace(/[%,()]/g, " ").trim();
}

function isClientStatus(value: string): value is ClientStatus {
  return value === "active" || value === "inactive";
}

function toNullableText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();

  return trimmed ? trimmed : null;
}

function toRequiredText(value: string | null | undefined, message: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    throw new ClientValidationError(message);
  }

  return trimmed;
}

function toNonNegativeNumber(value: number, message: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ClientValidationError(message);
  }

  return value;
}

function logClientError(
  operation: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("[clients] Supabase operation failed", {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function isConnectionError(error: { details?: string; message?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    text.includes("fetch failed") ||
    text.includes("enotfound") ||
    text.includes("econnrefused") ||
    text.includes("networkerror")
  );
}

function handleClientError(
  operation: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
): never {
  logClientError(operation, error);

  if (isConnectionError(error)) {
    throw new ClientConnectionError();
  }

  if (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "42804" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205"
  ) {
    throw new ClientDatabaseSetupError();
  }

  if (error.code === "42501" || error.message?.includes("row-level security")) {
    if (error.message?.includes("Approved payroll cannot be edited")) {
      throw new PayrollApprovedError();
    }

    throw new ClientPermissionError();
  }

  if (error.code === "23505") {
    if (error.message?.includes("workplace") || error.details?.includes("workplace")) {
      throw new ClientValidationError("A workpoint with this code already exists.");
    }

    throw new ClientValidationError("A client with this code already exists.");
  }

  if (error.code === "23514" || error.code === "23503" || error.code === "23502") {
    throw new ClientValidationError(error.message);
  }

  throw new Error("Unable to complete client operation.");
}

async function getCurrentAccess(
  supabase: SupabaseServerClient,
  allowedRoles: string[],
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logClientError("auth.getUser", userError);
    if (isConnectionError(userError)) {
      throw new ClientConnectionError();
    }

    throw new ClientAuthenticationError();
  }

  if (!user) {
    throw new ClientAuthenticationError();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    handleClientError("profiles.select", profileError);
  }

  const role = String((profile?.role ?? "") as ProfileRole);

  if (!profile || profile.is_active !== true || !allowedRoles.includes(role)) {
    throw new ClientPermissionError();
  }

  return { role, user };
}

async function assertClientViewAccess(supabase: SupabaseServerClient) {
  return getCurrentAccess(supabase, ["owner", "admin", "accounts"]);
}

async function assertOwnerAccess(supabase: SupabaseServerClient) {
  return getCurrentAccess(supabase, ["owner"]);
}

export async function getCurrentUserRole(supabase: SupabaseServerClient): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return "";
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return "";
  }

  return String(profile.role ?? "");
}

async function assertClientManageAccess(supabase: SupabaseServerClient) {
  return getCurrentAccess(supabase, ["owner", "admin"]);
}

async function assertPayrollEntryAccess(supabase: SupabaseServerClient) {
  return getCurrentAccess(supabase, ["owner", "admin", "accounts"]);
}

function validateClientInput(input: ClientInput): ClientInput {
  if (!isClientStatus(input.status)) {
    throw new ClientValidationError("Choose a valid client status.");
  }

  return {
    billing_address: toNullableText(input.billing_address),
    client_code: toRequiredText(input.client_code, "Client code is required."),
    contact_person: toNullableText(input.contact_person),
    email: toNullableText(input.email),
    name: toRequiredText(input.name, "Client name is required."),
    notes: toNullableText(input.notes),
    phone: toNullableText(input.phone),
    status: input.status,
  };
}

function validateWorkpointInput(input: WorkpointInput): WorkpointInput {
  if (!isClientStatus(input.status)) {
    throw new ClientValidationError("Choose a valid workpoint status.");
  }

  return {
    address: toNullableText(input.address),
    client_id: toRequiredText(input.client_id, "Client is required."),
    contact_person: toNullableText(input.contact_person),
    contact_phone: toNullableText(input.contact_phone),
    default_day_rate: toNonNegativeNumber(
      input.default_day_rate,
      "Default day rate must be zero or more.",
    ),
    default_night_rate: toNonNegativeNumber(
      input.default_night_rate,
      "Default night rate must be zero or more.",
    ),
    name: toRequiredText(input.name, "Workpoint name is required."),
    notes: toNullableText(input.notes),
    required_guards: toNonNegativeNumber(
      input.required_guards,
      "Required guards must be zero or more.",
    ),
    status: input.status,
    workplace_code: toRequiredText(input.workplace_code, "Workpoint code is required."),
  };
}

function summarizeEntries(
  entries: WorkpointPayrollEntry[],
): WorkpointPayrollSummary {
  return {
    contribution: entries.reduce(
      (total, entry) => total + Number(entry.line_gross ?? 0),
      0,
    ),
    entriesCount: entries.length,
    shifts: entries.reduce((total, entry) => total + Number(entry.shifts ?? 0), 0),
    workersCount: new Set(entries.map((entry) => entry.worker_id)).size,
    workpointsUsed: entries.length > 0 ? 1 : 0,
  };
}

export async function getClients(search = "") {
  const supabase = await createClient();
  await assertClientViewAccess(supabase);

  const searchTerm = sanitizeSearchTerm(search);
  let query = supabase
    .from("clients")
    .select(clientSelect)
    .order("name", { ascending: true })
    .limit(100);

  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `client_code.ilike.${pattern}`, `contact_person.ilike.${pattern}`].join(","),
    );
  }

  const { data, error } = await query;

  if (error) {
    handleClientError("clients.select", error);
  }

  const clients = (data ?? []) as Client[];
  const workpointCounts = new Map<string, number>();

  if (clients.length > 0) {
    const { data: workpoints, error: workpointsError } = await supabase
      .from("workplaces")
      .select("id, client_id")
      .in(
        "client_id",
        clients.map((client) => client.id),
      );

    if (workpointsError) {
      handleClientError("workplaces.count", workpointsError);
    }

    for (const workpoint of (workpoints ?? []) as { client_id: string }[]) {
      workpointCounts.set(
        workpoint.client_id,
        (workpointCounts.get(workpoint.client_id) ?? 0) + 1,
      );
    }
  }

  return clients.map((client) => ({
    ...client,
    workpointCount: workpointCounts.get(client.id) ?? 0,
  })) satisfies ClientWithWorkpointCount[];
}

export async function getClientDetail(clientId: string) {
  const supabase = await createClient();
  await assertClientViewAccess(supabase);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(clientSelect)
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    handleClientError("clients.selectOne", clientError);
  }

  if (!client) {
    return null;
  }

  const { data: workpoints, error: workpointsError } = await supabase
    .from("workplaces")
    .select(workpointSelect)
    .eq("client_id", clientId)
    .order("name", { ascending: true });

  if (workpointsError) {
    handleClientError("workplaces.select", workpointsError);
  }

  return {
    client: client as Client,
    workpoints: (workpoints ?? []) as Workpoint[],
  };
}

export async function createClientRecord(input: ClientInput) {
  const supabase = await createClient();
  const access = await assertClientManageAccess(supabase);
  const validated = validateClientInput(input);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...validated, created_by: access.user.id, updated_by: access.user.id })
    .select("id")
    .single();

  if (error) {
    handleClientError("clients.insert", error);
  }

  return data.id as string;
}

export async function createWorkpoint(input: WorkpointInput) {
  const supabase = await createClient();
  await assertClientManageAccess(supabase);
  const validated = validateWorkpointInput(input);

  const { data, error } = await supabase.rpc("save_workpoint", {
    p_address: validated.address,
    p_client_id: validated.client_id,
    p_contact_person: validated.contact_person,
    p_contact_phone: validated.contact_phone,
    p_default_day_rate: validated.default_day_rate,
    p_default_night_rate: validated.default_night_rate,
    p_name: validated.name,
    p_notes: validated.notes,
    p_required_guards: validated.required_guards,
    p_status: validated.status,
    p_workplace_code: validated.workplace_code,
  });

  if (error) {
    handleClientError("save_workpoint", error);
  }

  return data as string;
}

export async function getPayrollByClientData({
  month,
  search = "",
  year,
}: {
  month: number;
  search?: string;
  year: number;
}) {
  const clients = await getClients(search);
  const supabase = await createClient();
  await assertPayrollEntryAccess(supabase);

  const summaries = new Map<string, WorkpointPayrollSummary>();
  const clientWorkerSets = new Map<string, Set<string>>();
  const clientWorkpointSets = new Map<string, Set<string>>();

  for (const client of clients) {
    summaries.set(client.id, {
      contribution: 0,
      entriesCount: 0,
      shifts: 0,
      workersCount: 0,
      workpointsUsed: 0,
    });
    clientWorkerSets.set(client.id, new Set());
    clientWorkpointSets.set(client.id, new Set());
  }

  const unattributed = {
    contribution: 0,
    entriesCount: 0,
    shifts: 0,
    workersCount: 0,
    workpointsUsed: 0,
  };
  const unattributedWorkers = new Set<string>();
  const workpointsByClient = new Map<string, ClientWorkpointSummary[]>();
  const workersByClientWorkpoint = new Map<string, Map<string, ClientWorkpointWorkerSummary[]>>();

  const configuredWorkpointsByClient = new Map<string, Workpoint[]>();

  if (clients.length > 0) {
    const { data: workpoints, error: workpointsError } = await supabase
      .from("workplaces")
      .select(workpointSelect)
      .in("client_id", clients.map((client) => client.id))
      .order("name", { ascending: true });

    if (workpointsError) {
      handleClientError("workpoints.selectForClients", workpointsError);
    }

    for (const workpoint of (workpoints ?? []) as Workpoint[]) {
      const list = configuredWorkpointsByClient.get(workpoint.client_id) ?? [];
      list.push(workpoint);
      configuredWorkpointsByClient.set(workpoint.client_id, list);
    }
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, status")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (runError) {
    handleClientError("payroll_runs.select", runError);
  }

  if (run?.id) {
    type ClientPayrollEntryRow = {
      line_gross: number | string | null;
      shift_rate: number | string | null;
      shifts: number | string | null;
      workplace_id: string | null;
      workplace_name: string | null;
      workplaces: {
        id: string | null;
        name: string | null;
        workplace_code: string | null;
        client_id: string | null;
        clients: {
          id: string | null;
          name: string | null;
          client_code: string | null;
        } | null;
      } | null;
      payroll_records: {
        payroll_run_id: string;
        workers: {
          employee_no: string;
          full_name: string;
          id: string;
          worker_type: string;
        } | null;
      } | null;
    };

    function firstOrValue<T>(
      value: T | T[] | null | undefined,
    ): T | null | undefined {
      if (value == null) {
        return value;
      }

      if (Array.isArray(value)) {
        return value.length > 0 ? value[0] : null;
      }

      return value;
    }

    const clientWorkpointMap = new Map<
      string,
      Map<
        string,
        {
          code: string;
          contribution: number;
          id: string;
          name: string;
          shifts: number;
          workerSet: Set<string>;
        }
      >
    >();

    const workersByClientWorkpointAggr = new Map<
      string,
      Map<
        string,
        Map<
          string,
          {
            code: string;
            contribution: number;
            employeeNo: string;
            id: string;
            name: string;
            rateSet: Set<number>;
            shifts: number;
            workerType: string;
          }
        >
      >
    >();

    const { data: entriesData, error: entriesError } = await supabase
      .from("payroll_work_entries")
      .select(`
        id,
        workplace_id,
        workplace_name,
        shifts,
        shift_rate,
        line_gross,
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
            employee_no,
            full_name,
            worker_type
          )
        )
      `)
      .eq("payroll_records.payroll_run_id", run.id);

    if (entriesError) {
      handleClientError("payroll_work_entries.select", entriesError);
    }

    const entries = (entriesData ?? []) as unknown as ClientPayrollEntryRow[];

    for (const entry of entries) {
      const shifts = Number(entry.shifts ?? 0);
      const contribution = Number(entry.line_gross ?? 0);
      const wp = firstOrValue(entry.workplaces);
      const record = firstOrValue(entry.payroll_records);
      const worker = record?.workers ?? null;

      const client = wp?.clients ?? null;

      if (client?.id) {
        const aggr = summaries.get(client.id);

        if (!aggr) {
          continue;
        }

        aggr.contribution += contribution;
        aggr.entriesCount += 1;
        aggr.shifts += shifts;

        if (worker?.id) {
          clientWorkerSets.get(client.id)?.add(worker.id);
        }

        if (wp?.id) {
          clientWorkpointSets.get(client.id)?.add(wp.id);

          let wpMap = clientWorkpointMap.get(client.id);

          if (!wpMap) {
            wpMap = new Map();
            clientWorkpointMap.set(client.id, wpMap);
          }

          let wpAggr = wpMap.get(wp.id);

          if (!wpAggr) {
            wpAggr = {
              code: wp.workplace_code ?? "N/A",
              contribution: 0,
              id: wp.id,
              name: wp.name ?? "Unnamed Workpoint",
              shifts: 0,
              workerSet: new Set(),
            };

            wpMap.set(wp.id, wpAggr);
          }

          wpAggr.contribution += contribution;
          wpAggr.shifts += shifts;

          if (worker?.id) {
            wpAggr.workerSet.add(worker.id);

            let wpWorkerMap = workersByClientWorkpointAggr.get(client.id);

            if (!wpWorkerMap) {
              wpWorkerMap = new Map();
              workersByClientWorkpointAggr.set(client.id, wpWorkerMap);
            }

            let workerMap = wpWorkerMap.get(wp.id);

            if (!workerMap) {
              workerMap = new Map();
              wpWorkerMap.set(wp.id, workerMap);
            }

            let wAggr = workerMap.get(worker.id);

            if (!wAggr) {
              const workerData = firstOrValue(record?.workers);

              wAggr = {
                code: wp.workplace_code ?? "N/A",
                contribution: 0,
                employeeNo: workerData?.employee_no ?? "",
                id: worker.id,
                name: workerData?.full_name ?? "Unknown",
                rateSet: new Set(),
                shifts: 0,
                workerType: workerData?.worker_type ?? "permanent",
              };

              workerMap.set(worker.id, wAggr);
            }

            wAggr.contribution += contribution;
            wAggr.shifts += shifts;

            if (entry.shift_rate != null) {
              wAggr.rateSet.add(Number(entry.shift_rate));
            }
          }
        }
      } else {
        unattributed.contribution += contribution;
        unattributed.entriesCount += 1;
        unattributed.shifts += shifts;

        if (worker?.id) {
          unattributedWorkers.add(worker.id);
        }
      }
    }

    for (const [clientId, aggr] of summaries) {
      aggr.workersCount = clientWorkerSets.get(clientId)?.size ?? 0;
      aggr.workpointsUsed = clientWorkpointSets.get(clientId)?.size ?? 0;
    }

    unattributed.workersCount = unattributedWorkers.size;

    for (const [clientId, wpMap] of workersByClientWorkpointAggr) {
      const result = new Map<string, ClientWorkpointWorkerSummary[]>();

      for (const [wpId, workerMap] of wpMap) {
        const workers = Array.from(workerMap.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((w) => ({
            code: w.code,
            contribution: w.contribution,
            employeeNo: w.employeeNo,
            id: w.id,
            name: w.name,
            rates: Array.from(w.rateSet).sort((a, b) => a - b),
            shifts: w.shifts,
            workerType: w.workerType,
          }));

        result.set(wpId, workers);
      }

      workersByClientWorkpoint.set(clientId, result);
    }

    for (const client of clients) {
      const configured = configuredWorkpointsByClient.get(client.id) ?? [];
      const wpMap = clientWorkpointMap.get(client.id);

      workpointsByClient.set(
        client.id,
        configured
          .map((wp) => {
            const wpAggr = wpMap?.get(wp.id);
            return {
              code: wp.workplace_code,
              contribution: wpAggr?.contribution ?? 0,
              id: wp.id,
              name: wp.name,
              shifts: wpAggr?.shifts ?? 0,
              status: wp.status,
              workersCount: wpAggr?.workerSet.size ?? 0,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }

  return {
    clients,
    period: getPayrollPeriod(year, month),
    run: run ?? null,
    summaries,
    workpointsByClient,
    workersByClientWorkpoint,
    unattributed,
  };
}

export async function getWorkpointPayrollWorkspace({
  clientId,
  month,
  search = "",
  workpointId,
  year,
}: {
  clientId: string;
  month: number;
  search?: string;
  workpointId: string;
  year: number;
}) {
  const supabase = await createClient();
  await assertPayrollEntryAccess(supabase);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(clientSelect)
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    handleClientError("clients.selectWorkspace", clientError);
  }

  const { data: workpoint, error: workpointError } = await supabase
    .from("workplaces")
    .select(workpointSelect)
    .eq("id", workpointId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (workpointError) {
    handleClientError("workplaces.selectWorkspace", workpointError);
  }

  if (!client || !workpoint) {
    return null;
  }

  const { data: entriesData, error: entriesError } = await supabase.rpc(
    "get_workpoint_payroll_entries",
    {
      p_month: month,
      p_workplace_id: workpointId,
      p_year: year,
    },
  );

  if (entriesError) {
    handleClientError("get_workpoint_payroll_entries", entriesError);
  }

  const eligibleWorkers = await getPayrollEligibleWorkers({
    month,
    search,
    supabase,
    year,
  });
  const entries = (entriesData ?? []) as WorkpointPayrollEntry[];

  return {
    client: client as Client,
    entries,
    eligibleWorkers: eligibleWorkers.map(({ worker }) => worker) satisfies PayrollWorker[],
    period: getPayrollPeriod(year, month),
    summary: summarizeEntries(entries),
    workpoint: workpoint as Workpoint,
  };
}

export async function saveWorkpointPayrollEntry(input: WorkpointPayrollSaveInput) {
  const supabase = await createClient();
  await assertPayrollEntryAccess(supabase);

  if (!input.worker_id) {
    throw new PayrollValidationError("Choose a worker.");
  }

  if (!input.workplace_id) {
    throw new PayrollValidationError("Choose a workpoint.");
  }

  if (!Number.isFinite(input.shifts) || input.shifts < 0) {
    throw new PayrollValidationError("Shifts must be zero or more.");
  }

  if (!Number.isFinite(input.shift_rate) || input.shift_rate < 0) {
    throw new PayrollValidationError("Shift rate must be zero or more.");
  }

  if (input.entry_id) {
    await assertOwnerAccess(supabase);
  }

  const { data, error } = await supabase.rpc("save_workpoint_payroll_entry", {
    p_client_operation_id: input.client_operation_id ?? null,
    p_entry_id: input.entry_id,
    p_month: input.month,
    p_shift_rate: input.shift_rate,
    p_shifts: input.shifts,
    p_worker_id: input.worker_id,
    p_workplace_id: input.workplace_id,
    p_year: input.year,
  });

  if (error) {
    handleClientError("save_workpoint_payroll_entry", error);
  }

  return data as string;
}

export async function deleteWorkpointPayrollEntry(input: {
  entryId: string;
  month: number;
  workplaceId: string;
  year: number;
}) {
  const supabase = await createClient();
  await assertOwnerAccess(supabase);

  const { error } = await supabase.rpc("delete_workpoint_payroll_entry", {
    p_entry_id: input.entryId,
    p_month: input.month,
    p_workplace_id: input.workplaceId,
    p_year: input.year,
  });

  if (error) {
    handleClientError("delete_workpoint_payroll_entry", error);
  }
}
