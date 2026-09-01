"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let isMounted = true;

    function handleRegistrationError(error: unknown) {
      console.warn("[pwa] Service worker registration failed", error);
    }

    function watchInstallingWorker(worker: ServiceWorker) {
      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller &&
          isMounted
        ) {
          setWaitingWorker(worker);
        }
      });
    }

    function handleWindowLoad() {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (registration.waiting && isMounted) {
            setWaitingWorker(registration.waiting);
          }

          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;

            if (worker) {
              watchInstallingWorker(worker);
            }
          });
        })
        .catch(handleRegistrationError);
    }

    window.addEventListener("load", handleWindowLoad);

    return () => {
      isMounted = false;
      window.removeEventListener("load", handleWindowLoad);
    };
  }, []);

  function handleRefresh() {
    if (!waitingWorker) {
      return;
    }

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  if (!waitingWorker) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-md border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg sm:left-auto sm:right-5 sm:mx-0"
      role="status"
    >
      <div>
        <p className="font-bold">Application update available.</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Refresh when it is safe. Pending offline work is kept separately.
        </p>
      </div>
      <button
        className="app-focus btn-primary min-h-9 rounded-md px-3 text-xs font-bold transition"
        onClick={handleRefresh}
        type="button"
      >
        Refresh app
      </button>
    </div>
  );
}
