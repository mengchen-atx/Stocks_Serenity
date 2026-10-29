"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "./i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const OPTIONS: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

export function LangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={`flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs backdrop-blur transition ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={lang === value}
          onClick={() => choose(value)}
          className={`rounded-full px-3 py-1 font-medium transition ${
            lang === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
