"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/debts", label: "Debts", icon: DebtsIcon },
  { href: "/settings", label: "Profil", icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await Promise.allSettled([
        fetch("/api/sync/bank", { method: "POST" }),
        fetch("/api/sync/gmail", { method: "POST" }),
      ]);
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2 pointer-events-none">
      <div className="max-w-5xl mx-auto flex items-center justify-between pointer-events-auto">
        <nav className="flex items-center gap-1 bg-surface border border-border rounded-full px-2 py-2 shadow-lg">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 h-10 rounded-full transition-all ${
                  active ? "bg-accent text-bg px-4" : "text-secondary w-10 justify-center"
                }`}
              >
                <Icon active={active} />
                {active && <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSync}
          aria-label="Synchronisieren"
          disabled={syncing}
          className="w-12 h-12 rounded-full bg-accent text-bg flex items-center justify-center shadow-lg shrink-0 disabled:opacity-60"
        >
          <SyncIcon spinning={syncing} />
        </button>
      </div>
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#0b0b0d" : "currentColor"} strokeWidth="2">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function DebtsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#0b0b0d" : "currentColor"} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#0b0b0d" : "currentColor"} strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0b0b0d"
      strokeWidth="2"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M4.5 15a8 8 0 0014.5 3.5M19.5 9a8 8 0 00-14.5-3.5" />
    </svg>
  );
}
