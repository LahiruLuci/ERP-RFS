"use client";

import type { ClientWithWorkpointCount, Workpoint } from "@/lib/clients/types";
import type { Worker } from "@/lib/workers/types";
import type { PayrollWorker } from "@/lib/payroll/types";
import type { WorkpointPayrollEntry } from "@/lib/clients/types";

import {
  getCachedRecords,
  replaceCachedRecords,
  replaceCachedRecordsWhere,
  getCacheMetadata,
} from "./database";
import type {
  CachedClient,
  CachedPayrollWorkEntry,
  CachedPayrollWorkspace,
  CachedWorker,
  CachedWorkpoint,
} from "./types";

function toNumber(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(values: Array<string | null | undefined>, search: string) {
  const searchTerm = normalizeText(search);

  if (!searchTerm) {
    return true;
  }

  return values.some((value) => normalizeText(value ?? "").includes(searchTerm));
}

type CacheableWorker = Pick<
  Worker,
  | "default_shift_rate"
  | "employee_no"
  | "full_name"
  | "id"
  | "joined_date"
  | "nic"
  | "phone"
  | "status"
  | "updated_at"
  | "worker_type"
>;

type CacheablePayrollWorker = PayrollWorker & {
  nic?: string | null;
  phone?: string | null;
  updated_at?: string | null;
};

export async function cacheWorkers(
  workers: Array<CacheableWorker | CacheablePayrollWorker>,
) {
  await replaceCachedRecordsWhere(
    "workers",
    workers.map(
      (worker): CachedWorker => ({
        default_shift_rate: toNumber(worker.default_shift_rate),
        employee_no: worker.employee_no,
        full_name: worker.full_name,
        id: worker.id,
        joined_date: worker.joined_date,
        local_only: false,
        nic: worker.nic ?? null,
        operation_id: null,
        phone: worker.phone ?? null,
        status: worker.status,
        sync_status: "synced",
        updated_at: worker.updated_at ?? null,
        user_id: null,
        worker_type: worker.worker_type,
      }),
    ),
    (worker) => !worker.local_only,
  );
}

export async function readCachedWorkers(search = "") {
  const workers = await getCachedRecords<CachedWorker>("workers");

  return workers
    .filter((worker) =>
      matchesSearch(
        [worker.employee_no, worker.full_name, worker.nic, worker.phone],
        search,
      ),
    )
    .sort((first, second) => first.full_name.localeCompare(second.full_name));
}

export async function cacheClients(clients: ClientWithWorkpointCount[]) {
  await replaceCachedRecords(
    "clients",
    clients.map(
      (client): CachedClient => ({
        client_code: client.client_code,
        id: client.id,
        name: client.name,
        status: client.status,
        updated_at: client.updated_at ?? null,
        workpointCount: client.workpointCount,
      }),
    ),
  );
}

export async function readCachedClients(search = "") {
  const clients = await getCachedRecords<CachedClient>("clients");

  return clients
    .filter((client) => matchesSearch([client.client_code, client.name], search))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function cacheWorkpointsForClient(
  clientId: string,
  workpoints: Workpoint[],
) {
  await replaceCachedRecordsWhere(
    "workpoints",
    workpoints.map(
      (workpoint): CachedWorkpoint => ({
        client_id: workpoint.client_id,
        default_day_rate: toNumber(workpoint.default_day_rate),
        default_night_rate: toNumber(workpoint.default_night_rate),
        id: workpoint.id,
        name: workpoint.name,
        status: workpoint.status,
        updated_at: workpoint.updated_at ?? null,
      }),
    ),
    (workpoint) => workpoint.client_id === clientId,
  );
}

export async function readCachedWorkpoints(clientId?: string) {
  const workpoints = await getCachedRecords<CachedWorkpoint>("workpoints");

  return workpoints
    .filter((workpoint) => !clientId || workpoint.client_id === clientId)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function getPayrollWorkspaceCacheId({
  clientId,
  month,
  workpointId,
  year,
}: {
  clientId: string;
  month: number;
  workpointId: string;
  year: number;
}) {
  return `${clientId}:${workpointId}:${year}:${month}`;
}

export async function cachePayrollWorkspace(input: {
  clientId: string;
  clientName: string;
  entries: WorkpointPayrollEntry[];
  month: number;
  periodEnd: string;
  periodStart: string;
  workers: PayrollWorker[];
  workpointId: string;
  workpointDefaultDayRate: number | string;
  workpointName: string;
  year: number;
}) {
  const workspaceId = getPayrollWorkspaceCacheId({
    clientId: input.clientId,
    month: input.month,
    workpointId: input.workpointId,
    year: input.year,
  });
  const updatedAt = new Date().toISOString();

  await replaceCachedRecordsWhere(
    "payrollWorkspaces",
    [
      {
        client_id: input.clientId,
        client_name: input.clientName,
        eligible_workers: input.workers.map(
          (worker): CachedWorker => ({
            default_shift_rate: toNumber(worker.default_shift_rate),
            employee_no: worker.employee_no,
            full_name: worker.full_name,
            id: worker.id,
            joined_date: worker.joined_date,
            local_only: false,
            nic: null,
            operation_id: null,
            phone: null,
            status: worker.status,
            sync_status: "synced",
            updated_at: null,
            user_id: null,
            worker_type: worker.worker_type,
          }),
        ),
        eligible_worker_ids: input.workers.map((worker) => worker.id),
        id: workspaceId,
        month: input.month,
        period_end: input.periodEnd,
        period_start: input.periodStart,
        updated_at: updatedAt,
        workpoint_default_day_rate: toNumber(input.workpointDefaultDayRate),
        workpoint_id: input.workpointId,
        workpoint_name: input.workpointName,
        year: input.year,
      } satisfies CachedPayrollWorkspace,
    ],
    (workspace) => workspace.id === workspaceId,
  );

  await replaceCachedRecordsWhere(
    "payrollWorkEntries",
    input.entries.map(
      (entry): CachedPayrollWorkEntry => ({
        client_id: input.clientId,
        employee_no: entry.employee_no,
        entry_id: entry.entry_id,
        full_name: entry.full_name,
        line_gross: toNumber(entry.line_gross),
        local_only: false,
        month: input.month,
        operation_id: null,
        payroll_record_id: entry.payroll_record_id,
        shift_rate: toNumber(entry.shift_rate),
        shifts: toNumber(entry.shifts),
        sync_status: "synced",
        user_id: null,
        worker_id: entry.worker_id,
        worker_status: entry.worker_status,
        worker_type: entry.worker_type,
        workplace_id: input.workpointId,
        year: input.year,
      }),
    ),
    (entry) =>
      entry.client_id === input.clientId &&
      entry.workplace_id === input.workpointId &&
      entry.year === input.year &&
      entry.month === input.month &&
      !entry.local_only,
  );
}

export async function readCachedPayrollWorkspace(input: {
  clientId: string;
  month: number;
  workpointId: string;
  year: number;
}) {
  const workspaces =
    await getCachedRecords<CachedPayrollWorkspace>("payrollWorkspaces");
  const workspaceId = getPayrollWorkspaceCacheId(input);

  return workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
}

export async function readCachedPayrollWorkEntries(input: {
  clientId: string;
  month: number;
  userId?: string | null;
  workpointId: string;
  year: number;
}) {
  const entries =
    await getCachedRecords<CachedPayrollWorkEntry>("payrollWorkEntries");

  return entries
    .filter(
      (entry) =>
        entry.client_id === input.clientId &&
        entry.workplace_id === input.workpointId &&
        entry.year === input.year &&
        entry.month === input.month &&
        (!entry.local_only || !input.userId || entry.user_id === input.userId),
    )
    .sort((first, second) =>
      first.employee_no.localeCompare(second.employee_no) ||
      first.full_name.localeCompare(second.full_name),
    );
}

export { getCacheMetadata };
