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

function handleClientError(
  operation: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
): never {
  logClientError(operation, error);

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

  for (const client of clients) {
    summaries.set(client.id, {
      contribution: 0,
      entriesCount: 0,
      shifts: 0,
      workersCount: 0,
    });
  }

  return { clients, period: getPayrollPeriod(year, month), summaries };
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

  const { data, error } = await supabase.rpc("save_workpoint_payroll_entry", {
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
