export type Transaction = {
  id: string;
  vendor: string;
  category: string | null;
  amount: number;
  currency: string;
  charged_at: string;
  source: "email" | "bank" | "manual";
  status: "upcoming" | "completed";
};

export type AiInsight = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
};

export type Connection = {
  id: string;
  type: "email" | "bank";
  label: string;
  status: "connected" | "pending" | "error";
};
