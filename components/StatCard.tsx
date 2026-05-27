type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "bullish" | "bearish";
};

export function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  const toneClass = {
    neutral: "border-line bg-white",
    bullish: "border-emerald-200 bg-emerald-50",
    bearish: "border-rose-200 bg-rose-50"
  }[tone];

  return (
    <section className={`rounded-md border p-4 shadow-panel ${toneClass}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-normal text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </section>
  );
}
