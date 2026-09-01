"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getPendingMutationSummary,
  offlineQueueChangedEvent,
  syncPendingWorkEntries,
} from "@/lib/offline/work-entry-outbox";

type OnlineStatusContextValue = {
  isOnline: boolean;
  failedCount: number;
  pendingCount: number;
  syncNow: () => void;
  syncStatus: "idle" | "syncing";
  userId?: string;
};

const OnlineStatusContext = createContext<OnlineStatusContextValue | null>(null);

export function OnlineStatusProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: string;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncStatus, setSyncStatus] =
    useState<OnlineStatusContextValue["syncStatus"]>("idle");
  const hasObservedBrowserState = useRef(false);
  const router = useRouter();

  const refreshPendingCount = useCallback(() => {
    void getPendingMutationSummary(userId).then((summary) => {
      setPendingCount(summary.pending + summary.syncing);
      setFailedCount(summary.failed);
    }).catch(() => {
      setPendingCount(0);
      setFailedCount(0);
    });
  }, [userId]);

  const syncNow = useCallback(() => {
    if (!userId || !navigator.onLine) {
      refreshPendingCount();
      return;
    }

    setSyncStatus("syncing");
    void syncPendingWorkEntries(userId).finally(() => {
      setSyncStatus("idle");
      refreshPendingCount();
      router.refresh();
    });
  }, [refreshPendingCount, router, userId]);

  useEffect(() => {
    function updateOnlineStatus(nextIsOnline: boolean) {
      setIsOnline((previousIsOnline) => {
        if (
          hasObservedBrowserState.current &&
          previousIsOnline !== nextIsOnline
        ) {
          setMessage(
            nextIsOnline
              ? "Internet connection restored."
              : "Internet connection lost. You are currently offline.",
          );
        }

        hasObservedBrowserState.current = true;
        return nextIsOnline;
      });
    }

    updateOnlineStatus(navigator.onLine);

    function handleOnline() {
      updateOnlineStatus(true);
      syncNow();
    }

    function handleOffline() {
      updateOnlineStatus(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    refreshPendingCount();

    function handleQueueChanged() {
      refreshPendingCount();
    }

    window.addEventListener(offlineQueueChangedEvent, handleQueueChanged);

    const syncTimeoutId = window.setTimeout(() => {
      if (navigator.onLine) {
        syncNow();
      }
    }, 0);

    return () => {
      window.clearTimeout(syncTimeoutId);
      window.removeEventListener(offlineQueueChangedEvent, handleQueueChanged);
    };
  }, [refreshPendingCount, syncNow, userId]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  const value = useMemo(
    () => ({ failedCount, isOnline, pendingCount, syncNow, syncStatus, userId }),
    [failedCount, isOnline, pendingCount, syncNow, syncStatus, userId],
  );

  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
      {message ? (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-md border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-lg sm:left-auto sm:right-5 sm:mx-0"
          role="status"
        >
          {message}
        </div>
      ) : null}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus() {
  const context = useContext(OnlineStatusContext);

  if (!context) {
    throw new Error("useOnlineStatus must be used within OnlineStatusProvider.");
  }

  return context;
}

export function ConnectionStatusIndicator({
  className = "",
}: {
  className?: string;
}) {
  const { failedCount, isOnline, pendingCount, syncNow, syncStatus } =
    useOnlineStatus();
  const label = isOnline ? "Online" : "Offline";
  const classNames = isOnline
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const dotClassName = isOnline ? "bg-green-600" : "bg-amber-500";

  return (
    <div
      aria-label={`Connection status: ${label}`}
      className={`inline-flex min-h-9 flex-wrap items-center gap-2 rounded-full border px-3 text-xs font-bold ${classNames} ${className}`}
      role="status"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClassName}`} />
      <span>{label}</span>
      {failedCount > 0 ? (
        <span className="hidden whitespace-nowrap sm:inline">
          {failedCount} change{failedCount === 1 ? "" : "s"} need attention
        </span>
      ) : pendingCount > 0 ? (
        <span className="hidden whitespace-nowrap sm:inline">
          {syncStatus === "syncing"
            ? `Syncing ${pendingCount} changes...`
            : `${pendingCount} changes waiting`}
        </span>
      ) : isOnline ? (
        <span className="hidden whitespace-nowrap sm:inline">All changes synced</span>
      ) : null}
      {isOnline && pendingCount > 0 ? (
        <button
          className="app-focus rounded-full border border-current px-2 py-0.5 text-[0.68rem] font-bold transition hover:bg-white/60"
          disabled={syncStatus === "syncing"}
          onClick={syncNow}
          type="button"
        >
          Sync Now
        </button>
      ) : null}
    </div>
  );
}
