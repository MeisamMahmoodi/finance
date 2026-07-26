import type { Transaction, AiInsight, Connection } from "@/lib/types";

// Fallback-Daten, solange noch keine echten Verknüpfungen (E-Mail/Bank) bestehen.
export const demoTransactions: Transaction[] = [
  {
    id: "demo-1",
    vendor: "Apple One",
    category: "Abo",
    amount: 19.95,
    currency: "EUR",
    charged_at: new Date(Date.now() + 1 * 86400000).toISOString(),
    source: "email",
    status: "upcoming",
  },
  {
    id: "demo-2",
    vendor: "OpenAI Plus",
    category: "KI-Dienst",
    amount: 23.0,
    currency: "EUR",
    charged_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    source: "email",
    status: "upcoming",
  },
  {
    id: "demo-3",
    vendor: "Miete",
    category: "Fixkosten",
    amount: 890,
    currency: "EUR",
    charged_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    source: "bank",
    status: "upcoming",
  },
  {
    id: "demo-4",
    vendor: "Amazon",
    category: "Einkauf",
    amount: 54.3,
    currency: "EUR",
    charged_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    source: "email",
    status: "completed",
  },
  {
    id: "demo-5",
    vendor: "Netflix",
    category: "Abo",
    amount: 13.99,
    currency: "EUR",
    charged_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    source: "bank",
    status: "completed",
  },
];

export const demoInsights: AiInsight[] = [
  {
    id: "insight-1",
    kind: "price_increase",
    message:
      "OpenAI Plus wurde von 20 € auf 23 € erhöht (+15%). Seit März 2026.",
    created_at: new Date().toISOString(),
  },
  {
    id: "insight-2",
    kind: "unused_subscription",
    message:
      "Netflix läuft seit 40 Tagen ohne erkennbare neue Rechnung — prüfen ob noch genutzt.",
    created_at: new Date().toISOString(),
  },
];

export const demoConnections: Connection[] = [
  { id: "conn-1", type: "email", label: "Noch nicht verbunden", status: "pending" },
  { id: "conn-2", type: "bank", label: "Noch nicht verbunden", status: "pending" },
];
