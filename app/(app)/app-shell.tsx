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
  label: string;
  href: string;
  status: "active" | "coming-soon";
};

type NavigationSection = {
  label: string | null;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    label: null,
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        status: "active",
      },
    ],
  },
  {
    label: "Workforce",
    items: [
      {
        label: "Workers",
        href: "/workers",
        status: "active",
      },
      {
        label: "Clients",
        href: "/clients",
        status: "active",
      },
      {
        label: "Workplaces",
        href: "/workplaces",
        status: "coming-soon",
      },
      {
        label: "Assignments",
        href: "/assignments",
        status: "coming-soon",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      {
        label: "Payroll",
        href: "/payroll",
        status: "active",
      },
      {
        label: "Advances & Deductions",
        href: "/advances-deductions",
        status: "active",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Reports",
        href: "/reports",
        status: "active",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
        href: "/settings",
        status: "coming-soon",
      },
    ],
  },
];

const navigationItems = navigationSections.flatMap((section) => section.items);

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
    <div className="flex min-w-0 items-center gap-3">
      <Image
        alt="Royal Force Security Services"
        className="size-12 shrink-0 rounded-lg object-contain"
        height={48}
        priority
        src="/royal-force-logo.png"
        width={48}
      />
      <div className="min-w-0">
        <p className="truncate text-base font-bold leading-tight text-white">
          Royal Force
        </p>
        <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
          Security Services
        </p>
        {!compact ? (
          <p className="mt-1 truncate text-xs text-blue-100/75">
            Workforce & Payroll
          </p>
        ) : null}
      </div>
    </div>
  );
}

function NavigationList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {navigationSections.map((section) => (
        <div className="flex flex-col gap-1" key={section.label ?? "main"}>
          {section.label ? (
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100/55">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const baseClassName =
              "app-focus flex min-h-11 items-center justify-between rounded-md px-3 text-sm font-semibold transition";

            if (item.status === "coming-soon") {
              return (
                <button
                  aria-disabled="true"
                  className={`${baseClassName} cursor-not-allowed text-blue-100/35`}
                  disabled
                  key={item.href}
                  type="button"
                >
                  <span className="truncate">{item.label}</span>
                  <span className="ml-3 shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.68rem] font-bold text-blue-100/45">
                    Soon
                  </span>
                </button>
              );
            }

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`${baseClassName} ${isActive
                  ? "border-l-4 border-[var(--brand-accent)] bg-white text-[var(--brand-primary)] shadow-sm"
                  : "text-blue-50/80 hover:bg-white/[0.08] hover:text-white"
                  }`}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function LogoutButton({
  className = "",
  variant = "sidebar",
}: {
  className?: string;
  variant?: "header" | "sidebar";
}) {
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

  const variantClassName =
    variant === "header"
      ? "btn-secondary text-[var(--brand-primary)]"
      : "border border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.14]";

  return (
    <button
      className={`app-focus min-h-10 rounded-md px-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${variantClassName} ${className}`}
      disabled={isSigningOut}
      onClick={handleLogout}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}

function UserSummary({
  className = "",
  userEmail,
}: {
  className?: string;
  userEmail?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-black text-[var(--brand-primary)]">
        {getInitial(userEmail)}
      </div>
      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-sm font-semibold text-white">
          {userEmail || "Signed-in user"}
        </p>
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
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-[var(--brand-primary)] lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <BrandMark />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <NavigationList />
            </div>

            <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.07] p-3">
              <UserSummary userEmail={userEmail} />
              <LogoutButton className="mt-4 w-full" />
            </div>
          </div>
        </aside>

        {isMobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close navigation menu"
              className="absolute inset-0 bg-[var(--brand-primary)]/45"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            />
            <div className="relative flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[var(--brand-primary)] shadow-xl">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <BrandMark compact />
                <button
                  aria-label="Close navigation menu"
                  className="app-focus flex size-10 items-center justify-center rounded-md border border-white/15 text-xl leading-none text-white transition hover:bg-white/10"
                  onClick={() => setIsMobileMenuOpen(false)}
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <NavigationList onNavigate={() => setIsMobileMenuOpen(false)} />
                </div>

                <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.07] p-3">
                  <UserSummary userEmail={userEmail} />
                  <LogoutButton className="mt-4 w-full" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-dvh min-w-0 flex-col lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 xl:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Open navigation menu"
                  className="app-focus btn-secondary flex min-h-10 shrink-0 items-center justify-center rounded-md px-3 text-sm font-semibold transition lg:hidden"
                  onClick={() => setIsMobileMenuOpen(true)}
                  type="button"
                >
                  Menu
                </button>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-secondary)]">
                    Royal Force Security Services
                  </p>
                  <p className="truncate text-lg font-bold text-[var(--text-primary)]">
                    {currentPageTitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <ConnectionStatusIndicator />
              </div>

              <div className="hidden min-w-0 max-w-[min(32rem,48vw)] items-center justify-end gap-3 sm:flex">
                <div className="min-w-0 rounded-full bg-[var(--brand-primary)] px-2.5 py-2">
                  <UserSummary
                    className="max-w-[min(22rem,34vw)]"
                    userEmail={userEmail}
                  />
                </div>
                <LogoutButton
                  className="shrink-0"
                  variant="header"
                />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </OnlineStatusProvider>
  );
}


