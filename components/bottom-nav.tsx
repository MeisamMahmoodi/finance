"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export type TabKey = "home" | "debts" | "chat" | "settings";

const TABS: { key: TabKey; label: string; icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "debts", label: "Debts", icon: DebtsIcon },
  { key: "chat", label: "Chat", icon: ChatIcon },
  { key: "settings", label: "Profil", icon: ProfileIcon },
];

export function BottomNav({
  active,
  onChange,
  onSynced,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  onSynced: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await Promise.allSettled([
        fetch("/api/sync/bank", { method: "POST" }),
        fetch("/api/sync/gmail", { method: "POST" }),
      ]);
      onSynced();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2 pointer-events-none">
      <div className="max-w-[430px] mx-auto flex items-center justify-between pointer-events-auto">
        <nav className="liquid-glass-nav flex items-center gap-1 bg-white/65 border border-white/60 rounded-full px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.10)]">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className="relative flex items-center h-10 rounded-full"
                style={{ paddingLeft: isActive ? 16 : 0, paddingRight: isActive ? 16 : 0, width: isActive ? "auto" : 40 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-accent rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 justify-center w-full">
                  <Icon active={isActive} />
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      transition={{ duration: 0.15 }}
                      className="text-xs font-medium text-bg whitespace-nowrap overflow-hidden"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <motion.button
          onClick={handleSync}
          aria-label="Synchronisieren"
          disabled={syncing}
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 rounded-full bg-accent text-bg flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.18)] shrink-0 disabled:opacity-60"
        >
          <SyncIcon spinning={syncing} />
        </motion.button>
      </div>
    </div>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "#6b6b6f"} strokeWidth="2">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function DebtsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "#6b6b6f"} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "#6b6b6f"} strokeWidth="2">
      <path d="M4 4h16v12H8l-4 4V4z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "#6b6b6f"} strokeWidth="2">
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
      stroke="#ffffff"
      strokeWidth="2"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M4.5 15a8 8 0 0014.5 3.5M19.5 9a8 8 0 00-14.5-3.5" />
    </svg>
  );
}
