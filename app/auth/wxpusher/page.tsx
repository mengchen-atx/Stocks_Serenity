"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "wxpusher" | "password";

export default function WxPusherLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("wxpusher");

  // WxPusher state
  const [uid, setUid] = useState("");

  // Password state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function switchTab(t: Tab) {
    setTab(t);
    setError("");
  }

  async function handleWxPusherLogin() {
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

  async function handlePasswordLogin() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
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
          <p className="text-slate-400 text-sm mt-1">登录以访问 Dashboard</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => switchTab("wxpusher")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "wxpusher"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              WxPusher UID
            </button>
            <button
              onClick={() => switchTab("password")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "password"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              账号密码
            </button>
          </div>

          <div className="p-6">
            {success ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-green-400 font-medium">登录成功，正在跳转…</p>
              </div>
            ) : tab === "wxpusher" ? (
              <>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  WxPusher UID
                </label>
                <input
                  type="text"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && uid.trim() && handleWxPusherLogin()}
                  placeholder="UID_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-3"
                />
                <p className="text-slate-500 text-xs mb-4">
                  在 WxPusher App「我的」页面可以找到你的 UID
                </p>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={handleWxPusherLogin}
                  disabled={loading || !uid.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
                >
                  {loading ? "验证中…" : "进入 Dashboard"}
                </button>
              </>
            ) : (
              <>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && username.trim() && password && handlePasswordLogin()}
                  placeholder="输入用户名"
                  autoComplete="username"
                  className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-3"
                />
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && username.trim() && password && handlePasswordLogin()}
                  placeholder="输入密码"
                  autoComplete="current-password"
                  className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-4"
                />
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={handlePasswordLogin}
                  disabled={loading || !username.trim() || !password}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
                >
                  {loading ? "验证中…" : "进入 Dashboard"}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          仅付费用户可登录 · 7 天免重新验证
        </p>
      </div>
    </div>
  );
}
