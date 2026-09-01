"use client";

import { useEffect } from "react";

import type { ClientWithWorkpointCount, Workpoint } from "@/lib/clients/types";
import type { WorkpointPayrollEntry } from "@/lib/clients/types";
import type { Worker } from "@/lib/workers/types";
import type { PayrollWorker } from "@/lib/payroll/types";

import {
  cacheClients,
  cachePayrollWorkspace,
  cacheWorkers,
  cacheWorkpointsForClient,
} from "./cache";

export function OfflineCacheHydrator({
  clients,
  payrollWorkspace,
  workers,
  workpoints,
  workpointsClientId,
}: {
  clients?: ClientWithWorkpointCount[];
  payrollWorkspace?: {
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
  };
  workers?: Worker[];
  workpoints?: Workpoint[];
  workpointsClientId?: string;
}) {
  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }

    async function refreshCache() {
      if (workers) {
        await cacheWorkers(workers);
      }

      if (clients) {
        await cacheClients(clients);
      }

      if (workpoints && workpointsClientId) {
        await cacheWorkpointsForClient(workpointsClientId, workpoints);
      }

      if (payrollWorkspace) {
        await cachePayrollWorkspace(payrollWorkspace);
      }
    }

    void refreshCache();
  }, [clients, payrollWorkspace, workers, workpoints, workpointsClientId]);

  return null;
}
