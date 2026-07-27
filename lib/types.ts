export type Transaction = {
  id: string;
  vendor: string;
  category: string | null;
  amount: number;
  currency: string;
  charged_at: string;
  source: "email" | "bank" | "manual";
  status: "upcoming" | "completed";
  direction?: "in" | "out";
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

export type Debt = {
  id: string;
  name: string;
  total_amount: number;
  amount_paid: number;
  installments_total: number;
  installments_paid: number;
  next_due_date: string | null;
};

export type Box = {
  id: string;
  name: string;
  target_amount: number | null;
  saved_amount: number;
  color: string | null;
};
