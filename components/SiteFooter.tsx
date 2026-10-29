"use client";

import { usePathname } from "next/navigation";

/** The login page renders its own localized disclaimer. */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/auth")) return null;

  return (
    <footer className="text-center px-4 py-3 text-[11px] border-t border-slate-800 bg-[#0f172a] text-slate-500 tracking-wide">
      内容仅用于信息整理和研究辅助，不构成投资建议。
    </footer>
  );
}
