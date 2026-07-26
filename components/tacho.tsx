const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long" });

export function Tacho({
  available,
  income,
  fixed,
}: {
  available: number;
  income: number;
  fixed: number;
}) {
  const month = monthFormat.format(new Date());

  return (
    <div className="flex flex-col items-center py-8">
      <p className="text-secondary text-xs mb-1">Verfügbar · {month}</p>
      <p className="text-[44px] leading-none font-medium tracking-tight">
        {currencyFormat.format(available)}
      </p>
      <div className="flex gap-5 mt-3 text-xs">
        <span className="text-success flex items-center gap-1">
          <ArrowUp /> {currencyFormat.format(income)} Einnahmen
        </span>
        <span className="text-danger flex items-center gap-1">
          <ArrowDown /> {currencyFormat.format(fixed)} Fixkosten
        </span>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}
