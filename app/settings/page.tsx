"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type SubscriptionData = {
  tier: string;
  subscription: {
    status: string;
    tier: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/subscription")
        .then((r) => r.json())
        .then(setSubData)
        .catch(console.error);
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">加载中...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">请先登录</p>
          <Link
            href="/auth/signin"
            className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500"
          >
            立即登录
          </Link>
        </div>
      </div>
    );
  }

  async function handleManageBilling() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "portal" })
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "无法打开账单页面");
    } finally {
      setLoading(false);
    }
  }

  const tierLabel: Record<string, string> = {
    FREE: "免费版",
    BASIC: "基础版 ¥39/月",
    PRO: "专业版 ¥99/月",
    PREMIUM: "旗舰版 ¥199/月"
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Dashboard
          </Link>
          <h1 className="text-base font-semibold">账号设置</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900 mb-4">账号信息</h2>
          <div className="flex items-center gap-4">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-12 w-12 rounded-full" />
            )}
            <div>
              <p className="font-medium text-slate-900">{session.user.name ?? "未设置姓名"}</p>
              <p className="text-sm text-slate-500">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900 mb-4">订阅方案</h2>

          {subData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {tierLabel[subData.tier] ?? subData.tier}
                  </p>
                  {subData.subscription && (
                    <p className="text-sm text-slate-500">
                      状态：{subData.subscription.status}
                      {subData.subscription.cancelAtPeriodEnd && " · 到期后不续费"}
                      {" · "}到期时间：
                      {new Date(subData.subscription.currentPeriodEnd).toLocaleDateString("zh-CN")}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  {subData.subscription ? (
                    <button
                      onClick={handleManageBilling}
                      disabled={loading}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                    >
                      {loading ? "跳转中..." : "管理订阅"}
                    </button>
                  ) : (
                    <Link
                      href="/pricing"
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
                    >
                      升级方案
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">加载中...</p>
          )}
        </div>

        {/* Notification settings (placeholder) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900 mb-2">通知设置</h2>
          <p className="text-sm text-slate-500 mb-4">根据你的订阅方案，以下渠道可用：</p>
          <div className="space-y-3">
            {NOTIFICATION_CHANNELS.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{ch.label}</p>
                  <p className="text-xs text-slate-500">{ch.desc}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                  ch.tier === "FREE"
                    ? "bg-green-50 text-green-700"
                    : ch.tier === "BASIC"
                    ? "bg-blue-50 text-blue-700"
                    : ch.tier === "PRO"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {ch.tier}+
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATION_CHANNELS = [
  { id: "email", label: "邮件通知", desc: "每条新分析发送到你的邮箱", tier: "BASIC" },
  { id: "telegram", label: "Telegram 频道", desc: "推送到 Serenity Telegram 频道", tier: "PRO" },
  { id: "wechat", label: "微信企业号", desc: "推送到微信企业机器人", tier: "PREMIUM" }
];
