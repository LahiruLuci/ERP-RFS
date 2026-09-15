"use client";

import { useOnlineStatus } from "@/lib/connection/online-status";

export function DashboardOfflineStatus() {
  const { isOnline, pendingCount, failedCount } = useOnlineStatus();

  if (isOnline && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {!isOnline ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 font-bold text-orange-700">
          Offline
        </span>
      ) : null}
      {isOnline && pendingCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
          Syncing {pendingCount}
        </span>
      ) : null}
      {failedCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-bold text-red-700">
          {failedCount} Needs Attention
        </span>
      ) : null}
    </div>
  );
}
