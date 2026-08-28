export default function AppLoading() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-10"
      role="status"
    >
      <div className="app-surface flex w-full max-w-sm flex-col items-center rounded-lg px-6 py-8 text-center">
        <div className="relative flex size-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--border)]" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--brand-accent)]" />
          <div className="size-7 rounded-full bg-[var(--brand-primary)]" />
        </div>

        <p className="mt-5 text-sm font-bold text-[var(--text-primary)]">
          Loading
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Please wait while the page is prepared.
        </p>
      </div>
    </div>
  );
}
