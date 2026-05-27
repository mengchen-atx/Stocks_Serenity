type Stance = "bullish" | "bearish" | string;

export function SignalBadge({ stance }: { stance: Stance }) {
  const isBullish = stance === "bullish";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
        isBullish
          ? "bg-emerald-100 text-emerald-800"
          : "bg-rose-100 text-rose-800"
      }`}
    >
      {isBullish ? "利好" : "利空"}
    </span>
  );
}
