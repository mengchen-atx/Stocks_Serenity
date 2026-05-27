"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TIER_AMOUNTS_CNY, TIER_FEATURES } from "@/lib/stripe";

type Tier = "FREE" | "BASIC" | "PRO" | "PREMIUM";

const TIERS: Array<{
  id: Tier;
  name: string;
  badge?: string;
  highlight?: boolean;
}> = [
  { id: "FREE", name: "免费版" },
  { id: "BASIC", name: "基础版" },
  { id: "PRO", name: "专业版", badge: "最受欢迎", highlight: true },
  { id: "PREMIUM", name: "旗舰版", badge: "全功能" }
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<Tier | null>(null);

  async function handleSubscribe(tier: Tier) {
    if (tier === "FREE") {
      window.location.href = "/dashboard";
      return;
    }

    if (!session) {
      window.location.href = "/auth/signin?callbackUrl=/pricing";
      return;
    }

    setLoading(tier);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "checkout", tier })
      });

      if (!res.ok) throw new Error("Failed to create checkout session");
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("创建订阅失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <nav className="border-b border-white/10 bg-[#0a0f1a]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Serenity
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            Dashboard →
          </Link>
        </div>
      </nav>

      <div className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">简单透明的定价</h1>
            <p className="text-gray-400 text-lg">
              月费制，无合同，随时取消。选择适合你的方案。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => {
              const price = TIER_AMOUNTS_CNY[tier.id];
              const features = TIER_FEATURES[tier.id];
              const isCurrentTier =
                session?.user?.subscriptionTier === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`relative rounded-2xl border p-6 flex flex-col ${
                    tier.highlight
                      ? "border-teal-500/60 bg-teal-500/10 shadow-lg shadow-teal-900/30"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-semibold text-white">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-lg font-semibold">{tier.name}</h2>
                    <div className="mt-3 flex items-baseline gap-1">
                      {price === 0 ? (
                        <span className="text-3xl font-bold">免费</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold">¥{price}</span>
                          <span className="text-sm text-gray-400">/月</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ul className="flex-1 space-y-3 mb-8">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-teal-400 flex-shrink-0">✓</span>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isCurrentTier || loading === tier.id}
                    className={`w-full rounded-lg py-3 text-sm font-semibold transition-colors ${
                      isCurrentTier
                        ? "cursor-default bg-white/10 text-gray-500"
                        : tier.highlight
                        ? "bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-60"
                        : "border border-white/20 bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-60"
                    }`}
                  >
                    {isCurrentTier
                      ? "当前方案"
                      : loading === tier.id
                      ? "处理中..."
                      : tier.id === "FREE"
                      ? "免费开始"
                      : "立即订阅"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">常见问题</h2>
            <div className="space-y-6">
              {FAQ.map((item, i) => (
                <div key={i} className="border-b border-white/10 pb-6">
                  <h3 className="font-semibold mb-2">{item.q}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAQ = [
  {
    q: "推文分析有多快？",
    a: "Pro / Premium 用户通常在 serenity 发推后 30-60 秒内收到通知。Basic 用户约 1-2 分钟。"
  },
  {
    q: "支持哪些通知渠道？",
    a: "Basic 版支持邮件通知。Pro 版支持 Email + Telegram。Premium 版全渠道：微信 + Telegram + Email。"
  },
  {
    q: "可以随时取消吗？",
    a: "可以。随时在账号设置中取消订阅，当期结束后不再续费，不收取额外费用。"
  },
  {
    q: "AI 分析准确率如何？",
    a: "AI 基于 GPT-4o / Claude 4 结合专业知识图谱分析。我们标注置信度（0-100），低置信度分析仅供参考。投资决策请结合自身判断。"
  }
];
