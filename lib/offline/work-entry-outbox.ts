"use client";

import { calculateLineGross } from "@/lib/payroll/calculations";
import { createClient } from "@/lib/supabase/client";

import {
  deleteOfflineRecord,
  getOfflineRecords,
  putOfflineRecord,
} from "./database";
import type {
  CachedPayrollWorkEntry,
  CachedWorker,
  OfflineDeductionPayload,
  OfflineTemporaryWorkerPayload,
  OfflineWorkEntryPayload,
  PendingMutation,
} from "./types";

export const offlineQueueChangedEvent = "royalforce:offline-queue-changed";

let isSyncRunning = false;

function nowIso() {
  return new Date().toISOString();
}

function emitQueueChanged() {
  window.dispatchEvent(new Event(offlineQueueChangedEvent));
}

function toSafeNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN;
}

function getFriendlySyncError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  if (message.includes("Approved payroll cannot be edited")) {
    return "Could not sync this work entry because the payroll has already been approved.";
  }

  if (error.code === "42501" || message.includes("payroll-authorized")) {
    return "Sign in again with an authorized account to sync pending changes.";
  }

  if (error.code === "23514" || error.code === "23503") {
    return message || "This work entry needs attention before it can sync.";
  }

  return "This work entry could not sync. Please review it when online.";
}

function getFriendlyWorkerSyncError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("NIC already exists")) {
    return "A worker with this NIC already exists.";
  }

  if (
    error.code === "42501" ||
    message.includes("authorized") ||
    message.includes("manage workers")
  ) {
    return "You no longer have permission to create temporary workers.";
  }

  if (error.code === "23514" || error.code === "23503") {
    return message || "This temporary worker needs attention before it can sync.";
  }

  return "This temporary worker could not sync. Please review it when online.";
}

function isNetworkError(error: unknown) {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : JSON.stringify(error);

  return /fetch failed|networkerror|enotfound|econnrefused|failed to fetch/i.test(
    text,
  );
}

function validatePayload(payload: OfflineWorkEntryPayload) {
  if (!payload.worker_id) {
    throw new Error("Choose a worker.");
  }

  if (!payload.workplace_id) {
    throw new Error("Choose a workpoint.");
  }

  if (
    payload.year < 2000 ||
    payload.year > 2100 ||
    payload.month < 1 ||
    payload.month > 12
  ) {
    throw new Error("Choose a valid payroll period.");
  }

  if (!Number.isFinite(payload.shifts) || payload.shifts < 0) {
    throw new Error("Shifts must be zero or more.");
  }

  if (!Number.isFinite(payload.shift_rate) || payload.shift_rate < 0) {
    throw new Error("Shift rate must be zero or more.");
  }
}

function validateTemporaryWorkerPayload(payload: OfflineTemporaryWorkerPayload) {
  if (!payload.worker_id || !payload.full_name.trim()) {
    throw new Error("Full Name is required.");
  }

  if (!payload.nic.trim()) {
    throw new Error("NIC is required.");
  }

  if (!payload.phone.trim()) {
    throw new Error("Mobile number is required.");
  }

  if (!Number.isFinite(payload.default_shift_rate) || payload.default_shift_rate < 0) {
    throw new Error("Default Shift Rate must be zero or more.");
  }
}

function payloadHasWorkerId(
  payload: PendingMutation["payload"],
): payload is OfflineDeductionPayload | OfflineWorkEntryPayload {
  return "worker_id" in payload;
}

export async function getPendingMutationCount(userId?: string | null) {
  const summary = await getPendingMutationSummary(userId);

  return summary.pending + summary.syncing;
}

export async function getPendingMutationSummary(userId?: string | null) {
  if (!userId) {
    return { failed: 0, pending: 0, syncing: 0 };
  }

  const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");
  const userMutations = mutations.filter(
    (mutation) => mutation.user_id === userId,
  );

  return {
    failed: userMutations.filter((mutation) => mutation.status === "failed").length,
    pending: userMutations.filter((mutation) => mutation.status === "pending").length,
    syncing: userMutations.filter((mutation) => mutation.status === "syncing").length,
  };
}

export async function hasPendingPayrollMutations(input: {
  month: number;
  userId?: string | null;
  year: number;
}) {
  if (!input.userId) {
    return false;
  }

  const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");

  return mutations.some(
    (mutation) =>
      mutation.user_id === input.userId &&
      "year" in mutation.payload &&
      mutation.payload.year === input.year &&
      mutation.payload.month === input.month &&
      mutation.status !== "failed",
  );
}

export async function queueOfflineTemporaryWorker(input: {
  address: string | null;
  defaultShiftRate: number;
  fullName: string;
  nic: string;
  notes: string | null;
  phone: string;
  userId: string;
}) {
  const existingWorkers = await getOfflineRecords<CachedWorker>("workers");
  const nic = input.nic.trim();
  const phone = input.phone.trim();
  const duplicate = existingWorkers.find(
    (worker) =>
      worker.nic?.trim().toLowerCase() === nic.toLowerCase() ||
      (!!phone && worker.phone?.trim() === phone),
  );

  if (duplicate?.nic?.trim().toLowerCase() === nic.toLowerCase()) {
    throw new Error("A worker with this NIC already exists.");
  }

  if (duplicate) {
    throw new Error("A possible matching worker already exists. Review before syncing.");
  }

  const operationId = crypto.randomUUID();
  const workerId = crypto.randomUUID();
  const payload: OfflineTemporaryWorkerPayload = {
    address: input.address?.trim() || null,
    client_operation_id: operationId,
    default_shift_rate: toSafeNumber(input.defaultShiftRate),
    full_name: input.fullName.trim(),
    nic,
    notes: input.notes?.trim() || null,
    phone,
    worker_id: workerId,
  };

  validateTemporaryWorkerPayload(payload);

  const createdAt = nowIso();
  const mutation: PendingMutation = {
    created_at: createdAt,
    depends_on_operation_id: null,
    entity_id: workerId,
    entity_type: "temporary_worker",
    id: operationId,
    last_error: null,
    operation_id: operationId,
    operation_type: "create",
    payload,
    retry_count: 0,
    status: "pending",
    updated_at: createdAt,
    user_id: input.userId,
  };
  const worker: CachedWorker = {
    address: payload.address,
    default_shift_rate: payload.default_shift_rate,
    employee_no: "Pending Registration",
    full_name: payload.full_name,
    id: workerId,
    joined_date: createdAt.slice(0, 10),
    local_only: true,
    nic: payload.nic,
    notes: payload.notes,
    operation_id: operationId,
    phone: payload.phone,
    status: "active",
    sync_status: "pending",
    updated_at: createdAt,
    user_id: input.userId,
    worker_type: "temporary",
  };

  await putOfflineRecord("pendingMutations", mutation);
  await putOfflineRecord("workers", worker);
  emitQueueChanged();

  return worker;
}

export async function queueOfflineWorkEntry(input: {
  clientId: string;
  employeeNo: string;
  fullName: string;
  month: number;
  shiftRate: number;
  shifts: number;
  userId: string;
  worker: CachedWorker;
  workerId: string;
  workplaceId: string;
  year: number;
}) {
  const operationId = crypto.randomUUID();
  const payload: OfflineWorkEntryPayload = {
    client_id: input.clientId,
    client_operation_id: operationId,
    month: input.month,
    shift_rate: toSafeNumber(input.shiftRate),
    shifts: toSafeNumber(input.shifts),
    worker_id: input.workerId,
    workplace_id: input.workplaceId,
    year: input.year,
  };

  validatePayload(payload);

  const createdAt = nowIso();
  const mutation: PendingMutation = {
    created_at: createdAt,
    depends_on_operation_id: input.worker.operation_id ?? null,
    entity_id: null,
    entity_type: "payroll_work_entry",
    id: operationId,
    last_error: null,
    operation_id: operationId,
    operation_type: "create",
    payload,
    retry_count: 0,
    status: "pending",
    updated_at: createdAt,
    user_id: input.userId,
  };
  const lineGross = calculateLineGross({
    shiftRate: payload.shift_rate,
    shifts: payload.shifts,
  });
  const entry: CachedPayrollWorkEntry = {
    client_id: input.clientId,
    employee_no: input.employeeNo,
    entry_id: `local-${operationId}`,
    full_name: input.fullName,
    line_gross: lineGross,
    local_only: true,
    month: input.month,
    operation_id: operationId,
    payroll_record_id: null,
    shift_rate: payload.shift_rate,
    shifts: payload.shifts,
    sync_status: "pending",
    user_id: input.userId,
    worker_id: input.workerId,
    worker_status: input.worker.status,
    worker_type: input.worker.worker_type,
    workplace_id: input.workplaceId,
    year: input.year,
  };

  await putOfflineRecord("pendingMutations", mutation);
  await putOfflineRecord("payrollWorkEntries", entry);
  emitQueueChanged();

  return entry;
}

export async function cancelPendingWorkEntry(operationId: string, userId?: string | null) {
  if (!userId) {
    return;
  }

  const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");
  const mutation = mutations.find(
    (item) => item.operation_id === operationId && item.user_id === userId,
  );

  if (!mutation || mutation.status === "syncing") {
    return;
  }

  await deleteOfflineRecord("pendingMutations", mutation.id);
  await deleteOfflineRecord("payrollWorkEntries", `local-${operationId}`);
  emitQueueChanged();
}

export async function cancelPendingTemporaryWorker(
  operationId: string,
  userId?: string | null,
) {
  if (!userId) {
    return;
  }

  const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");
  const mutation = mutations.find(
    (item) =>
      item.operation_id === operationId &&
      item.user_id === userId &&
      item.entity_type === "temporary_worker",
  );
  const hasDependents = mutations.some(
    (item) =>
      item.user_id === userId &&
      item.depends_on_operation_id === operationId &&
      item.status !== "failed",
  );

  if (!mutation || mutation.status === "syncing" || hasDependents) {
    return;
  }

  await deleteOfflineRecord("pendingMutations", mutation.id);
  await deleteOfflineRecord("workers", mutation.entity_id ?? "");
  emitQueueChanged();
}

async function updateMutation(mutation: PendingMutation) {
  await putOfflineRecord("pendingMutations", {
    ...mutation,
    updated_at: nowIso(),
  });
}

async function updateCachedEntryStatus(
  operationId: string,
  status: CachedPayrollWorkEntry["sync_status"],
) {
  const entries =
    await getOfflineRecords<CachedPayrollWorkEntry>("payrollWorkEntries");
  const entry = entries.find((item) => item.operation_id === operationId);

  if (entry) {
    await putOfflineRecord("payrollWorkEntries", {
      ...entry,
      sync_status: status,
    });
  }
}

async function updateCachedWorkerStatus(
  operationId: string,
  status: NonNullable<CachedWorker["sync_status"]>,
) {
  const workers = await getOfflineRecords<CachedWorker>("workers");
  const worker = workers.find((item) => item.operation_id === operationId);

  if (worker) {
    await putOfflineRecord("workers", {
      ...worker,
      sync_status: status,
    });
  }
}

async function syncTemporaryWorkerMutation(mutation: PendingMutation) {
  if (mutation.entity_type !== "temporary_worker") {
    return "failed";
  }

  const payload = mutation.payload as OfflineTemporaryWorkerPayload;

  await updateMutation({
    ...mutation,
    last_error: null,
    status: "syncing",
  });
  await updateCachedWorkerStatus(mutation.operation_id, "syncing");
  emitQueueChanged();

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await updateMutation({
      ...mutation,
      last_error: "Sign in again to sync pending changes.",
      status: "pending",
    });
    await updateCachedWorkerStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "auth";
  }

  if (user.id !== mutation.user_id) {
    await updateMutation({
      ...mutation,
      last_error: "Sign in with the account that created this pending worker.",
      status: "pending",
    });
    await updateCachedWorkerStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "auth";
  }

  const { data, error } = await supabase.rpc("create_temporary_worker", {
    p_address: payload.address,
    p_client_operation_id: payload.client_operation_id,
    p_default_shift_rate: payload.default_shift_rate,
    p_full_name: payload.full_name,
    p_nic: payload.nic,
    p_notes: payload.notes,
    p_phone: payload.phone,
    p_worker_id: payload.worker_id,
  });

  if (!error) {
    const workerId = String(data ?? payload.worker_id);
    const { data: serverWorker } = await supabase
      .from("workers")
      .select("employee_no, full_name, nic, phone, joined_date, default_shift_rate, status, worker_type, updated_at")
      .eq("id", workerId)
      .maybeSingle();
    const workers = await getOfflineRecords<CachedWorker>("workers");
    const worker = workers.find((item) => item.operation_id === mutation.operation_id);

    if (worker) {
      await putOfflineRecord("workers", {
        ...worker,
        default_shift_rate: Number(
          serverWorker?.default_shift_rate ?? worker.default_shift_rate,
        ),
        employee_no: String(serverWorker?.employee_no ?? worker.employee_no),
        full_name: String(serverWorker?.full_name ?? worker.full_name),
        id: workerId,
        joined_date: (serverWorker?.joined_date as string | null | undefined) ?? worker.joined_date,
        local_only: false,
        nic: (serverWorker?.nic as string | null | undefined) ?? worker.nic,
        phone: (serverWorker?.phone as string | null | undefined) ?? worker.phone,
        status: (serverWorker?.status ?? worker.status) as CachedWorker["status"],
        sync_status: "synced",
        updated_at: String(serverWorker?.updated_at ?? worker.updated_at ?? nowIso()),
        worker_type: (serverWorker?.worker_type ?? worker.worker_type) as CachedWorker["worker_type"],
      });
    }

    await deleteOfflineRecord("pendingMutations", mutation.id);
    emitQueueChanged();
    return "synced";
  }

  if (error.code === "23505" || error.message?.includes("NIC already exists")) {
    const { data: existingWorker } = await supabase
      .from("workers")
      .select("id, employee_no, full_name, nic, phone, joined_date, default_shift_rate, status, worker_type, updated_at")
      .ilike("nic", payload.nic)
      .maybeSingle();

    if (existingWorker?.id) {
      const workerId = String(existingWorker.id);
      const workers = await getOfflineRecords<CachedWorker>("workers");
      const worker = workers.find(
        (item) => item.operation_id === mutation.operation_id,
      );
      const dependentMutations =
        await getOfflineRecords<PendingMutation>("pendingMutations");
      const dependentEntries =
        await getOfflineRecords<CachedPayrollWorkEntry>("payrollWorkEntries");

      if (worker) {
        await putOfflineRecord("workers", {
          ...worker,
          default_shift_rate: Number(
            existingWorker.default_shift_rate ?? worker.default_shift_rate,
          ),
          employee_no: String(existingWorker.employee_no ?? worker.employee_no),
          full_name: String(existingWorker.full_name ?? worker.full_name),
          id: workerId,
          joined_date:
            (existingWorker.joined_date as string | null | undefined) ??
            worker.joined_date,
          local_only: false,
          nic: (existingWorker.nic as string | null | undefined) ?? worker.nic,
          operation_id: null,
          phone:
            (existingWorker.phone as string | null | undefined) ??
            worker.phone,
          status: (existingWorker.status ?? worker.status) as CachedWorker["status"],
          sync_status: "synced",
          updated_at: String(existingWorker.updated_at ?? worker.updated_at ?? nowIso()),
          worker_type: (existingWorker.worker_type ??
            worker.worker_type) as CachedWorker["worker_type"],
        });

        if (worker.id !== workerId) {
          await deleteOfflineRecord("workers", worker.id);
        }
      }

      for (const dependentMutation of dependentMutations) {
        if (
          dependentMutation.depends_on_operation_id === mutation.operation_id &&
          dependentMutation.user_id === mutation.user_id &&
          payloadHasWorkerId(dependentMutation.payload)
        ) {
          await putOfflineRecord("pendingMutations", {
            ...dependentMutation,
            depends_on_operation_id: null,
            last_error: null,
            payload: {
              ...dependentMutation.payload,
              worker_id: workerId,
            },
            status:
              dependentMutation.status === "failed"
                ? "pending"
                : dependentMutation.status,
            updated_at: nowIso(),
          });
        }
      }

      for (const entry of dependentEntries) {
        if (
          entry.operation_id &&
          dependentMutations.some(
            (dependentMutation) =>
              dependentMutation.operation_id === entry.operation_id &&
              dependentMutation.depends_on_operation_id === mutation.operation_id,
          )
        ) {
          await putOfflineRecord("payrollWorkEntries", {
            ...entry,
            employee_no: String(existingWorker.employee_no ?? entry.employee_no),
            full_name: String(existingWorker.full_name ?? entry.full_name),
            sync_status: entry.sync_status === "failed" ? "pending" : entry.sync_status,
            worker_id: workerId,
            worker_status: (existingWorker.status ??
              entry.worker_status) as CachedPayrollWorkEntry["worker_status"],
            worker_type: (existingWorker.worker_type ??
              entry.worker_type) as CachedPayrollWorkEntry["worker_type"],
          });
        }
      }

      await deleteOfflineRecord("pendingMutations", mutation.id);
      emitQueueChanged();
      return "synced";
    }
  }

  if (isNetworkError(error)) {
    await updateMutation({
      ...mutation,
      last_error: "Sync paused. Waiting for connection.",
      retry_count: mutation.retry_count + 1,
      status: "pending",
    });
    await updateCachedWorkerStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "network";
  }

  await updateMutation({
    ...mutation,
    last_error: getFriendlyWorkerSyncError(error),
    retry_count: mutation.retry_count + 1,
    status: "failed",
  });
  await updateCachedWorkerStatus(mutation.operation_id, "failed");
  emitQueueChanged();
  return "failed";
}

async function syncMutation(mutation: PendingMutation) {
  if (mutation.entity_type === "temporary_worker") {
    return syncTemporaryWorkerMutation(mutation);
  }

  if (mutation.entity_type !== "payroll_work_entry") {
    return "failed";
  }

  if (mutation.depends_on_operation_id) {
    const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");
    const dependency = mutations.find(
      (item) => item.operation_id === mutation.depends_on_operation_id,
    );

    if (dependency?.status === "failed") {
      await updateMutation({
        ...mutation,
        last_error: "Waiting for temporary worker resolution.",
        status: "failed",
      });
      await updateCachedEntryStatus(mutation.operation_id, "failed");
      emitQueueChanged();
      return "failed";
    }

    if (dependency) {
      return "waiting";
    }
  }

  const payload = mutation.payload as OfflineWorkEntryPayload;

  await updateMutation({
    ...mutation,
    last_error: null,
    status: "syncing",
  });
  await updateCachedEntryStatus(mutation.operation_id, "syncing");
  emitQueueChanged();

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    await updateMutation({
      ...mutation,
      last_error: "Sign in again to sync pending changes.",
      status: "pending",
    });
    await updateCachedEntryStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "auth";
  }

  if (user.id !== mutation.user_id) {
    await updateMutation({
      ...mutation,
      last_error: "Sign in with the account that created this pending entry.",
      status: "pending",
    });
    await updateCachedEntryStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "auth";
  }

  const { error } = await supabase.rpc("save_workpoint_payroll_entry", {
    p_client_operation_id: payload.client_operation_id,
    p_entry_id: null,
    p_month: payload.month,
    p_shift_rate: payload.shift_rate,
    p_shifts: payload.shifts,
    p_worker_id: payload.worker_id,
    p_workplace_id: payload.workplace_id,
    p_year: payload.year,
  });

  if (!error) {
    await deleteOfflineRecord("pendingMutations", mutation.id);
    await deleteOfflineRecord("payrollWorkEntries", `local-${mutation.operation_id}`);
    emitQueueChanged();
    return "synced";
  }

  if (isNetworkError(error)) {
    await updateMutation({
      ...mutation,
      last_error: "Sync paused. Waiting for connection.",
      retry_count: mutation.retry_count + 1,
      status: "pending",
    });
    await updateCachedEntryStatus(mutation.operation_id, "pending");
    emitQueueChanged();
    return "network";
  }

  await updateMutation({
    ...mutation,
    last_error: getFriendlySyncError(error),
    retry_count: mutation.retry_count + 1,
    status: "failed",
  });
  await updateCachedEntryStatus(mutation.operation_id, "failed");
  emitQueueChanged();
  return "failed";
}

async function processQueue(userId: string) {
  const mutations = await getOfflineRecords<PendingMutation>("pendingMutations");
  const pendingMutations = mutations
    .filter(
      (mutation) =>
        mutation.user_id === userId &&
        mutation.status === "pending",
    )
    .sort((first, second) => first.created_at.localeCompare(second.created_at));

  for (const mutation of pendingMutations) {
    const result = await syncMutation(mutation);

    if (result === "network" || result === "auth") {
      break;
    }
  }
}

type LockManagerLike = {
  request<TValue>(
    name: string,
    options: { ifAvailable?: boolean; mode: "exclusive" },
    callback: (lock: unknown) => Promise<TValue> | TValue,
  ): Promise<TValue>;
};

export async function syncPendingWorkEntries(userId?: string | null) {
  if (!userId || isSyncRunning) {
    return;
  }

  const lockManager = (navigator as Navigator & { locks?: LockManagerLike })
    .locks;
  isSyncRunning = true;

  try {
    if (lockManager) {
      await lockManager.request(
        "royalforce-offline-sync",
        { ifAvailable: true, mode: "exclusive" },
        async (lock) => {
          if (!lock) {
            return;
          }

          await processQueue(userId);
        },
      );
      return;
    }

    await processQueue(userId);
  } finally {
    isSyncRunning = false;
    emitQueueChanged();
  }
}
