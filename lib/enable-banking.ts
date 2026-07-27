import crypto from "crypto";

const APP_ID = process.env.ENABLE_BANKING_APP_ID;
const PRIVATE_KEY = (process.env.ENABLE_BANKING_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const BASE_URL = "https://api.enablebanking.com";

function base64url(input: Buffer | string) {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Signiert ein kurzlebiges App-JWT (max. 24h laut Enable-Banking-Doku, wir nutzen 1h).
// Identifiziert nur unsere App, niemals einen einzelnen Nutzer.
function signAppJwt(): string {
  if (!APP_ID || !PRIVATE_KEY) {
    throw new Error("ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY nicht gesetzt");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: APP_ID };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), PRIVATE_KEY);
  return `${signingInput}.${base64url(signature)}`;
}

async function ebFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${signAppJwt()}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Enable Banking ${path} fehlgeschlagen (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export type Aspsp = {
  name: string;
  country: string;
  logo?: string;
  bic?: string;
  maximum_consent_validity?: number;
};

export async function listAspsps(country: string): Promise<Aspsp[]> {
  const data = await ebFetch(`/aspsps?country=${encodeURIComponent(country)}`);
  return (data.aspsps ?? []) as Aspsp[];
}

export async function startAuth(params: {
  aspspName: string;
  aspspCountry: string;
  redirectUrl: string;
  state: string;
  validUntil: string; // ISO-Datum
}): Promise<{ url: string; authorization_id: string }> {
  return ebFetch("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: {
        valid_until: params.validUntil,
        balances: true,
        transactions: true,
      },
      aspsp: { name: params.aspspName, country: params.aspspCountry },
      state: params.state,
      redirect_url: params.redirectUrl,
      psu_type: "personal",
    }),
  });
}

export type EbAccount = {
  uid: string;
  account_id?: { iban?: string };
  currency?: string;
  name?: string;
  product?: string;
};

export async function exchangeSession(code: string): Promise<{
  session_id: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
  access: { valid_until: string };
}> {
  return ebFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export type EbTransaction = {
  entry_reference?: string;
  transaction_amount: { amount: string; currency: string };
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
  booking_date?: string;
  value_date?: string;
  credit_debit_indicator: "CRDT" | "DBIT";
};

export type EbBalance = {
  name?: string;
  balance_amount: { amount: string; currency: string };
  balance_type: string;
  reference_date?: string;
};

// Bevorzugte Reihenfolge, welcher Balance-Typ als "aktueller Kontostand"
// gilt, falls die Bank mehrere zurückgibt (siehe Enable-Banking-Doku
// BalanceStatus: XPCD = Instant/Expected, CLAV = Closing Available,
// CLBD = Closing Booked).
const BALANCE_TYPE_PRIORITY = ["XPCD", "CLAV", "ITAV", "CLBD", "ITBD"];

export async function getAccountBalance(accountUid: string): Promise<number | null> {
  const data = await ebFetch(`/accounts/${accountUid}/balances`);
  const balances = (data.balances ?? []) as EbBalance[];
  console.log(`[enable-banking] Balances für ${accountUid}:`, JSON.stringify(balances));
  if (balances.length === 0) return null;

  for (const type of BALANCE_TYPE_PRIORITY) {
    const match = balances.find((b) => b.balance_type === type);
    if (match) return parseFloat(match.balance_amount.amount);
  }
  return parseFloat(balances[0].balance_amount.amount);
}

export async function listTransactions(
  accountUid: string,
  opts: { dateFrom?: string; continuationKey?: string; strategy?: string } = {},
): Promise<{ transactions: EbTransaction[]; continuation_key?: string }> {
  const params = new URLSearchParams();
  // Enable Banking verlangt ein reines Datum (YYYY-MM-DD, Uhrzeit=0), keinen vollen Zeitstempel.
  if (opts.dateFrom) params.set("date_from", opts.dateFrom.slice(0, 10));
  if (opts.continuationKey) params.set("continuation_key", opts.continuationKey);
  if (opts.strategy) params.set("strategy", opts.strategy);
  const qs = params.toString();
  return ebFetch(`/accounts/${accountUid}/transactions${qs ? `?${qs}` : ""}`);
}
