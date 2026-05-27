"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function SignInForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleGoogleSignIn() {
    setLoading("google");
    await signIn("google", { callbackUrl });
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading("email");
    try {
      await signIn("email", { email, callbackUrl, redirect: false });
      setEmailSent(true);
    } finally {
      setLoading(null);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mb-4 text-4xl">📧</div>
          <h2 className="text-2xl font-bold mb-3">查看你的邮箱</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            我们已向 <strong className="text-white">{email}</strong> 发送了一封登录邮件。
            点击邮件中的链接完成登录。
          </p>
          <Link href="/" className="mt-8 inline-block text-sm text-teal-400 hover:text-teal-300">
            ← 返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Serenity
          </Link>
          <p className="mt-2 text-gray-400 text-sm">登录以访问 AI 投资情报</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/20 bg-white/8 px-4 py-3 text-sm font-medium text-white hover:bg-white/12 transition-colors disabled:opacity-60"
          >
            <GoogleIcon />
            {loading === "google" ? "跳转中..." : "使用 Google 登录"}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-xs text-gray-500">或使用邮箱</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Email Magic Link */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-white/20 bg-white/8 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            />
            <button
              type="submit"
              disabled={loading !== null || !email}
              className="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 transition-colors disabled:opacity-60"
            >
              {loading === "email" ? "发送中..." : "发送登录链接"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            登录即代表你同意我们的
            <a href="#" className="text-teal-400 hover:underline mx-1">服务条款</a>
            和
            <a href="#" className="text-teal-400 hover:underline mx-1">隐私政策</a>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          还没有账号？{" "}
          <Link href="/pricing" className="text-teal-400 hover:text-teal-300">
            查看套餐方案
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
