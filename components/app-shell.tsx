"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav, type TabKey } from "@/components/bottom-nav";
import { HomeScreen } from "@/components/home-screen";
import { DebtsScreen } from "@/components/debts-screen";
import { ChatScreen } from "@/components/chat-screen";
import { SettingsScreen } from "@/components/settings-screen";
import type { AppData } from "@/lib/app-data";

type SettingsParams = {
  gmail_connected?: string;
  gmail_error?: string;
  bank_connected?: string;
  bank_error?: string;
};

// Zentrale App-Shell: Home/Debts/Settings sind Tabs innerhalb derselben
// Route, nicht mehr eigene Next.js-Seiten. Ein Tab-Wechsel ist damit reiner
// Client-State (sofort, keine Server-Roundtrip) statt einer vollen
// Navigation mit neuem Datenabruf - das war der Grund für das langsame
// Tab-Switching vorher.
export function AppShell({
  data,
  initialTab,
  settingsParams,
}: {
  data: AppData;
  initialTab: TabKey;
  settingsParams: SettingsParams;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);

  function handleTabChange(next: TabKey) {
    if (next === tab) return;
    setTab(next);
    const path = next === "home" ? "/" : `/${next}`;
    window.history.replaceState(null, "", path);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {tab === "home" && (
            <HomeScreen
              data={data}
              onRefresh={refresh}
              onSettingsClick={() => handleTabChange("settings")}
              onOpenChat={() => handleTabChange("chat")}
            />
          )}
          {tab === "debts" && <DebtsScreen debts={data.debts} onRefresh={refresh} />}
          {tab === "chat" && (
            <ChatScreen
              insights={data.insights}
              pendingReviews={data.pendingReviews}
              initialMessages={data.chatMessages}
              onRefresh={refresh}
            />
          )}
          {tab === "settings" && (
            <SettingsScreen
              userEmail={data.userEmail}
              gmailConnection={data.gmailConnection}
              bankConnections={data.bankConnections}
              monthlyIncome={data.monthlyIncome}
              hasIncomeSet={data.hasIncomeSet}
              searchParams={settingsParams}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <BottomNav active={tab} onChange={handleTabChange} onSynced={refresh} />
    </>
  );
}
