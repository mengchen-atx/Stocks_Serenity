"use client";

import { useRouter } from "next/navigation";

interface Props {
  fallbackHref: string;
  label: string;
}

export function BackButton({ fallbackHref, label }: Props) {
  const router = useRouter();

  function handleBack() {
    // If there's browser history, go back; otherwise fall back to feed
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
    >
      ← {label}
    </button>
  );
}
