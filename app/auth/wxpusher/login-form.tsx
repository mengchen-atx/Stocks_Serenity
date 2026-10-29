"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "wxpusher" | "password";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-teal-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-teal-400/20";

const primaryButtonClass =
  "w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

export function LoginForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("wxpusher");
  const [uid, setUid] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
  }

  async function submit(url: string, body: Record<string, string>) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "登录失败，请稍后再试");
        return;
      }
      setSuccess(true);
      router.push("/dashboard");
    } catch {
      setError("网络错误，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }

  const canSubmitUid = uid.trim().length > 0 && !loading;
  const canSubmitPassword = username.trim().length > 0 && password.length > 0 && !loading;

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
        <p className="text-sm text-slate-300">登录成功，正在进入 Dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/10 bg-white/[0.03] p-1 text-sm" role="tablist">
        {(
          [
            ["wxpusher", "WxPusher UID"],
            ["password", "账号密码"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => switchTab(value)}
            className={`rounded-md py-1.5 font-medium transition ${
              tab === value ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "wxpusher" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmitUid) submit("/api/auth/wxpusher/login", { uid: uid.trim() });
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">WxPusher UID</span>
            <input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="UID_xxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
          </label>
          <p className="text-xs text-slate-500">在 WxPusher App「我的」页面可以找到你的 UID</p>
          {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
          <button type="submit" disabled={!canSubmitUid} className={primaryButtonClass}>
            {loading ? "验证中…" : "登录"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmitPassword) submit("/api/auth/password/login", { username: username.trim(), password });
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">用户名</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              autoComplete="username"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              className={inputClass}
            />
          </label>
          {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
          <button type="submit" disabled={!canSubmitPassword} className={primaryButtonClass}>
            {loading ? "验证中…" : "登录"}
          </button>
        </form>
      )}
    </div>
  );
}
