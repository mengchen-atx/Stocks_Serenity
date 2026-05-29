import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SubscribePage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const { reason } = await searchParams;
  const isExpired = reason === "expired";

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="max-w-md w-full">

        {/* 图标 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{isExpired ? "⏰" : "🔐"}</div>
          <h1 className="text-2xl font-bold text-white">
            {isExpired ? "订阅已到期" : "需要付费订阅"}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {session.user.email}
          </p>
        </div>

        {/* 说明卡片 */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
          <p className="text-slate-300 text-sm leading-relaxed">
            {isExpired
              ? "你的订阅已到期，续费后即可继续访问实时 AI 投资信号 Dashboard。"
              : "Dashboard 为付费会员专属功能，订阅后即可实时查看所有 AI 分析结果、利好利空信号和热榜排行。"}
          </p>

          <div className="mt-4 space-y-2">
            {["实时 AI 分析所有 @aleabitoreddit 推文", "利好 / 利空股票信号一目了然", "近30天最热提及股票热榜", "微信同步推送，Dashboard 同步展示"].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-green-400">✓</span>
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* 联系订阅 */}
        <div className="bg-blue-950 border border-blue-800 rounded-xl p-5 mb-4">
          <p className="text-blue-300 text-sm font-medium mb-2">📱 如何订阅？</p>
          <p className="text-blue-200 text-sm leading-relaxed">
            扫描下方二维码关注 WxPusher 话题，完成付费后联系管理员开通 Dashboard 权限。
          </p>
          <p className="text-blue-400 text-xs mt-3">
            开通后刷新此页面即可访问。
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <a
            href="https://wxpusher.zjiecode.com/demo/sub.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            扫码订阅 WxPusher →
          </a>
          <Link
            href="/"
            className="block w-full text-center bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
          >
            返回首页
          </Link>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          已付费但无法访问？请联系管理员核实账号 {session.user.email}
        </p>

      </div>
    </div>
  );
}
