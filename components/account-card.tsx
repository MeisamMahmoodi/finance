const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function AccountCard({
  label,
  masked,
  balance,
  tone = "accent",
}: {
  label: string;
  masked: string;
  balance: number;
  tone?: "accent" | "success";
}) {
  return (
    <div className="bg-surface rounded-card p-4 flex flex-col gap-3 min-w-[160px] flex-1">
      <div className="flex items-center justify-between">
        <span className="text-sm truncate">{label}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${
            tone === "success" ? "bg-success/20 text-success" : "bg-accent/20 text-accent"
          }`}
        >
          {masked}
        </span>
      </div>
      <p className="text-xl font-medium">{currencyFormat.format(balance)}</p>
    </div>
  );
}
