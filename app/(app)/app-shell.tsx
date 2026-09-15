"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  ConnectionStatusIndicator,
  OnlineStatusProvider,
  useOnlineStatus,
} from "@/lib/connection/online-status";
import { getPendingMutationCount } from "@/lib/offline/work-entry-outbox";
import { createClient } from "@/lib/supabase/client";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string;
  userId?: string;
};

type NavigationItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  section: string;
  status: "active" | "coming-soon";
};

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 13.5L9 7.5l6 6M4.5 10.5h6.75v6.75H4.5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 10.5h6.75v6.75h-6.75z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Dashboard",
    section: "Main",
    status: "active",
  },
  {
    href: "/workers",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M15 19.128a9.38 9.38 0 0 0 2.627-3.128M15 19.128A9.38 9.38 0 0 1 15 15M15 19.128V15a3 3 0 1 1 6 0v4.128M12 15a3 3 0 1 0-6 0v-4.128a9.38 9.38 0 0 0 2.627 3.128M12 15V9.75a3 3 0 1 1 6 0V15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Workers",
    section: "Workforce",
    status: "active",
  },
  {
    href: "/clients",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Clients",
    section: "Workforce",
    status: "active",
  },
  {
    href: "/workplaces",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243A8 8 0 1 1 17.657 16.657z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Workplaces",
    section: "Workforce",
    status: "coming-soon",
  },
  {
    href: "/assignments",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM9 12h6M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Assignments",
    section: "Workforce",
    status: "coming-soon",
  },
  {
    href: "/payroll",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 12h6M9 16h6M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Payroll",
    section: "Payroll",
    status: "active",
  },
  {
    href: "/advances-deductions",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M2 7h20M2 12h20M2 17h20" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Advances & Deductions",
    section: "Payroll",
    status: "active",
  },
  {
    href: "/reports",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 16l4-8 4 4 5-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Reports",
    section: "Reports",
    status: "active",
  },
  {
    href: "/settings",
    icon: (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 15a3 3 0 0 1 3-3m0 0a3 3 0 0 1 3 3v1m-3-3a3 3 0 0 1-3 3m0 0a3 3 0 0 1-3-3m3 3v-1m-3 1a3 3 0 0 1-3 3m0 0a3 3 0 0 1-3-3m3-3v1m-6.364 1.636a9 9 0 0 1 0-12.728m12.728 0a9 9 0 0 1 0 12.728" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Settings",
    section: "System",
    status: "coming-soon",
  },
];

function getInitial(email?: string) {
  return email?.trim().charAt(0).toUpperCase() || "U";
}

function getCurrentPageTitle(pathname: string) {
  return (
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ||
    "Dashboard"
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        alt="Royal Force Security Services"
        className="size-10 shrink-0 rounded-md object-contain"
        height={40}
        priority
        src="/royal-force-logo.png"
        width={40}
      />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white">
            Royal Force
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">
            Security Services
          </p>
          <p className="truncate text-[11px] text-blue-100/60">
            Workforce & Payroll
          </p>
        </div>
      )}
    </div>
  );
}

function NavigationList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const sections = navigationItems.reduce<Record<string, typeof navigationItems>>((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

  const orderedSections = Object.keys(sections).sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a.localeCompare(b);
  });

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-6">
      {orderedSections.map((section) => (
        <div className="flex flex-col gap-1" key={section ?? "main"}>
          {section ? (
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/50">
              {section}
            </p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {sections[section].map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isComingSoon = item.status === "coming-soon";

              if (isComingSoon) {
                return (
                  <button
                    aria-disabled="true"
                    className="app-focus flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-blue-100/30"
                    disabled
                    key={item.href}
                    type="button"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center opacity-60">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-blue-100/40">
                      Soon
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`app-focus relative flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-blue-50/75 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 size-3 -translate-y-1/2 rounded-r bg-[var(--brand-accent)]" />
                  )}
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center ${
                      isActive ? "text-white" : "text-blue-100/70"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function LogoutButton({ className = "" }: { className?: string }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { userId } = useOnlineStatus();

  async function handleLogout() {
    if (userId) {
      const pendingCount = await getPendingMutationCount(userId);
      if (pendingCount > 0) {
        if (!window.confirm(`You have ${pendingCount} unsynchronized changes on this device. They will remain stored for this account.\n\nAre you sure you want to sign out?`)) {
          return;
        }
      }
    }

    setIsSigningOut(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type: "CLEAR_AUTH_ROUTE_CACHE",
      });
    }

    const supabase = createClient();
    await supabase.auth.signOut();

    window.location.replace("/login");
  }

  return (
    <button
      className={`app-focus flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.14] disabled:cursor-wait disabled:opacity-70 ${className}`}
      disabled={isSigningOut}
      onClick={handleLogout}
      type="button"
    >
      <svg aria-hidden="true" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}

function UserSummary({ userEmail }: { userEmail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-black text-[var(--brand-primary)]">
        {getInitial(userEmail)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{userEmail || "Signed-in user"}</p>
        <p className="truncate text-xs text-blue-100/70">Authenticated</p>
      </div>
    </div>
  );
}

export function AppShell({ children, userEmail, userId }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const currentPageTitle = getCurrentPageTitle(pathname);

  return (
    <OnlineStatusProvider userId={userId}>
      <div className="app-bg min-h-dvh overflow-x-hidden text-[var(--text-primary)]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[var(--brand-primary)] lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-4 py-4">
            <BrandMark />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 px-3 py-4">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
              <NavigationList />
            </div>

            <div className="shrink-0 space-y-3">
              <UserSummary userEmail={userEmail} />
              <LogoutButton />
            </div>
          </div>
        </aside>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close navigation menu"
              className="absolute inset-0 bg-[var(--brand-primary)]/50"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            />
            <div className="relative flex h-full w-[min(16rem,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[var(--brand-primary)] shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <BrandMark compact />
                <button
                  aria-label="Close navigation menu"
                  className="app-focus flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-xl leading-none text-white transition hover:bg-white/10"
                  onClick={() => setIsMobileMenuOpen(false)}
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-6 px-3 py-4">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
                  <NavigationList onNavigate={() => setIsMobileMenuOpen(false)} />
                </div>

                <div className="shrink-0 space-y-3">
                  <UserSummary userEmail={userEmail} />
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-dvh min-w-0 flex-col lg:pl-64">
          <header className="fixed top-0 right-0 left-0 z-20 border-b border-[var(--border)] bg-white shadow-sm lg:left-64">
            <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Open navigation menu"
                  className="app-focus btn-secondary flex min-h-9 shrink-0 items-center justify-center rounded-md px-3 text-sm font-semibold transition lg:hidden"
                  onClick={() => setIsMobileMenuOpen(true)}
                  type="button"
                >
                  Menu
                </button>

                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-secondary)]">
                    Royal Force Security Services
                  </p>
                  <p className="truncate text-base font-bold text-[var(--text-primary)]">
                    {currentPageTitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <ConnectionStatusIndicator />
              </div>

              <div className="hidden items-center justify-end gap-3 sm:flex">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-black text-white">
                    {getInitial(userEmail)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {userEmail || "Signed-in user"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">Authenticated</p>
                  </div>
                </div>
                <LogoutButton className="shrink-0" />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 pt-14 pb-6 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </OnlineStatusProvider>
  );
}
