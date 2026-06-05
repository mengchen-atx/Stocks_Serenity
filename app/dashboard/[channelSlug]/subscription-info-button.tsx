"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export type ChannelAccessInfo = {
  slug: string;
  name: string;
  expiresAt: string | null;
  pushEnabled: boolean;
  pushExpiresAt: string | null;
  isTopicSubscriber: boolean;
};

function daysLeft(isoDate: string | null): number | null {
  if (!isoDate) return null;
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

function ExpiryChip({ isoDate }: { isoDate: string | null }) {
  if (!isoDate) return (
    <span className="text-teal-400 font-semibold text-xs">永久有效</span>
  );
  const days = daysLeft(isoDate)!;
  if (days < 0) return <span className="text-red-400 text-xs font-semibold">已过期</span>;
  const color = days <= 7 ? "text-orange-400" : days <= 30 ? "text-yellow-400" : "text-slate-300";
  return (
    <span className={`${color} text-xs`}>
      {new Date(isoDate).toLocaleDateString("zh-CN")} · 剩 <strong>{days}</strong> 天
    </span>
  );
}

export function SubscriptionInfoButton({ accesses, mobile }: { accesses: ChannelAccessInfo[]; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Fixed position for mobile to escape overflow containers
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Recalculate position when opening on mobile
  useEffect(() => {
    if (!open || !mobile || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = Math.min(288, window.innerWidth - 16); // 72*4=288, keep 8px each side
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
    setPos({ top: rect.bottom + 6, left: Math.max(8, left) });
  }, [open, mobile]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const insideBtn = btnRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideBtn && !insidePanel) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const soonestDays = accesses
    .flatMap((a) => {
      const items: (number | null)[] = [daysLeft(a.expiresAt)];
      if (a.pushEnabled || a.isTopicSubscriber) items.push(daysLeft(a.pushExpiresAt));
      return items;
    })
    .filter((d): d is number => d !== null);
  const minDays = soonestDays.length > 0 ? Math.min(...soonestDays) : null;
  const urgentBadge = minDays !== null && minDays <= 7;

  const panel = (
    <div
      ref={panelRef}
      style={mobile ? { position: "fixed", top: pos.top, left: pos.left, width: Math.min(288, window.innerWidth - 16) } : undefined}
      className={`${mobile ? "" : "absolute right-0 top-full mt-2 w-72"} rounded-xl border border-slate-700 bg-[#0d1526] shadow-2xl shadow-black/60 z-[9999] overflow-hidden`}
    >
      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-300">我的频道权限</p>
      </div>
      <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
        {accesses.map((a) => {
          const pushExpired = a.pushExpiresAt !== null && new Date(a.pushExpiresAt) <= new Date();
          const canPush = !pushExpired && (a.isTopicSubscriber || a.pushEnabled);
          return (
            <div key={a.slug} className="px-4 py-3 space-y-2">
              <p className="text-sm font-semibold text-slate-100">{a.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">🖥 Dashboard</span>
                <ExpiryChip isoDate={a.expiresAt} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">📲 推送</span>
                {canPush
                  ? <ExpiryChip isoDate={a.pushExpiresAt} />
                  : <span className="text-slate-600 text-xs">未开启</span>
                }
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 border-t border-slate-800">
        <p className="text-[10px] text-slate-600">
          如需续期，请联系管理员 Wx：<span className="text-slate-400 font-medium select-all">PM112629</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-md border font-medium transition-colors ${
          mobile ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
        } ${
          urgentBadge
            ? "border-orange-600/60 text-orange-400 hover:border-orange-500 hover:bg-orange-900/20"
            : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
      >
        📋 我的订阅
        {urgentBadge && (
          <span className="ml-0.5 h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
        )}
      </button>

      {open && (
        mobile && mounted
          ? createPortal(panel, document.body)
          : panel
      )}
    </div>
  );
}
