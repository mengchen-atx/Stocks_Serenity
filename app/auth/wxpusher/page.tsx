"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WxPusherLoginPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wxpusher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 800);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📊</div>
          <h1 className="text-xl font-bold text-white">Serenity Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">输入你的 WxPusher UID 登录</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-green-400 font-medium">登录成功，正在跳转…</p>
            </div>
          ) : (
            <>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                WxPusher UID
              </label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && uid.trim() && handleLogin()}
                placeholder="UID_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-3"
              />
              <p className="text-slate-500 text-xs mb-4">
                在 WxPusher App「我的」页面可以找到你的 UID
              </p>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <button
                onClick={handleLogin}
                disabled={loading || !uid.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? "验证中…" : "进入 Dashboard"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          仅付费订阅用户可登录 · 7 天免重新验证
        </p>
      </div>
    </div>
  );
}
