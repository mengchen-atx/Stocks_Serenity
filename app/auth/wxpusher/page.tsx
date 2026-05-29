"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "uid" | "otp" | "success";

export default function WxPusherLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("uid");
  const [uid, setUid] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function sendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wxpusher/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid.trim() })
      });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) { setError(data.error ?? "发送失败"); return; }
      setMessage(data.message ?? "验证码已发送");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wxpusher/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uid.trim(), code: code.trim() })
      });
      const data = await res.json() as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) { setError(data.error ?? "验证失败"); return; }
      setStep("success");
      setTimeout(() => router.push("/dashboard"), 1200);
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
          <p className="text-slate-400 text-sm mt-1">用 WxPusher UID 登录</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">

          {step === "success" && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-green-400 font-medium">登录成功，正在跳转…</p>
            </div>
          )}

          {step === "uid" && (
            <>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                你的 WxPusher UID
              </label>
              <input
                type="text"
                value={uid}
                onChange={e => setUid(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
                placeholder="UID_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-3"
              />
              <p className="text-slate-500 text-xs mb-4">
                在 WxPusher App 的「我的」页面可以找到你的 UID
              </p>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={loading || !uid.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? "发送中…" : "发送验证码到微信"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="text-center mb-5">
                <div className="text-2xl mb-2">📱</div>
                <p className="text-slate-300 text-sm">{message}</p>
                <p className="text-slate-500 text-xs mt-1">验证码 10 分钟内有效</p>
              </div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                输入验证码
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && code.length === 6 && verify()}
                placeholder="6 位数字"
                maxLength={6}
                className="w-full bg-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-3 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none mb-3 text-center text-xl tracking-widest"
              />
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <button
                onClick={verify}
                disabled={loading || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors mb-3"
              >
                {loading ? "验证中…" : "登录"}
              </button>
              <button
                onClick={() => { setStep("uid"); setCode(""); setError(""); }}
                className="w-full text-slate-400 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                重新输入 UID
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
