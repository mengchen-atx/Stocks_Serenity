import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1a] text-white">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0a0f1a]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">Serenity</span>
            <span className="rounded bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-400">
              AI Intelligence
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
              定价
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link
              href="/auth/wxpusher"
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
            >
              立即开始
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-32">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-teal-600/10 blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/8 blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-400">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            实时监控 @serenity · 已分析 2,847 条推文
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            AI Infra
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
              Narrative Terminal
            </span>
          </h1>

          <p className="mb-10 text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            实时追踪科技投资 KOL 观点，AI 深度分析投资逻辑，
            自动映射 CPO / 半导体 / AI 电力 受益股票，
            <br />1 分钟内推送到微信、Telegram 和邮件。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/wxpusher"
              className="rounded-lg bg-teal-600 px-8 py-4 text-base font-semibold text-white hover:bg-teal-500 transition-colors shadow-lg shadow-teal-900/40"
            >
              免费开始 →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-gray-300 hover:bg-white/10 transition-colors"
            >
              查看 Dashboard
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-600">免费套餐 · 无需信用卡 · 随时取消</p>
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold">为什么选择 Serenity？</h2>
          <p className="mb-16 text-center text-gray-400 text-base">不是简单翻译推文。是 AI 驱动的产业链认知压缩。</p>

          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 transition-colors"
              >
                <div className="mb-4 text-3xl">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white/2">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-3xl font-bold">工作流程</h2>
          <p className="mb-16 text-center text-gray-400">从推文到投资信号，全自动，不超过 1 分钟</p>

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/50 to-transparent" />
            <div className="space-y-8">
              {STEPS.map((step, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="relative flex-shrink-0">
                    <div className="h-16 w-16 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl z-10 relative">
                      {step.icon}
                    </div>
                  </div>
                  <div className="flex-1 pt-3">
                    <h3 className="font-semibold text-base">{step.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sectors ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-3xl font-bold">覆盖核心 AI 投资赛道</h2>
          <p className="mb-12 text-gray-400">深度知识图谱，精准映射产业链受益标的</p>
          <div className="flex flex-wrap justify-center gap-3">
            {SECTORS.map((sector) => (
              <span
                key={sector}
                className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm text-teal-400"
              >
                {sector}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-900/30 to-blue-900/30 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">准备好了吗？</h2>
          <p className="mb-8 text-gray-400">
            加入正在使用 Serenity 的 AI 美股投资者社群
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="rounded-lg bg-teal-600 px-8 py-4 text-base font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              查看订阅方案
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/20 px-8 py-4 text-base font-semibold text-gray-300 hover:bg-white/10 transition-colors"
            >
              免费体验
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-12 px-6 text-center text-sm text-gray-600">
        <p>© 2025 Serenity Intelligence · AI Infra Narrative Terminal</p>
      </footer>
    </main>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "⚡",
    title: "实时推送 <1 分钟",
    desc: "serenity 发推后，AI 在 60 秒内完成分析并推送到微信、Telegram 和邮件。"
  },
  {
    icon: "🧠",
    title: "AI 产业链分析",
    desc: "不只是翻译。AI 理解供应链逻辑，从 CPO 到 HBM 再到电力管理，推导真正受益的 ticker。"
  },
  {
    icon: "📊",
    title: "历史观点数据库",
    desc: "所有分析存档，可按 ticker、主题、时间筛选，构建你的投资 playbook。"
  },
  {
    icon: "🔭",
    title: "多维度情绪追踪",
    desc: "实时统计利好 / 利空信号，识别市场 narrative 轮动与强度变化。"
  },
  {
    icon: "🗺️",
    title: "知识图谱驱动",
    desc: "内置 AI Infra 知识图谱，覆盖 CPO、光模块、GPU、HVDC 等 30+ 赛道与相关 ticker。"
  },
  {
    icon: "💎",
    title: "付费即用，按需订阅",
    desc: "月费制，无年费锁定，随时取消。Free / Basic / Pro / Premium 四档满足不同需求。"
  }
];

const STEPS = [
  { icon: "🔍", title: "每分钟轮询 @serenity", desc: "Twitter API 实时监听，自动去重，支持增量拉取。" },
  { icon: "🌐", title: "AI 中文翻译", desc: "保留行业术语，微信媒体风格，不机翻。" },
  { icon: "🔗", title: "供应链推导", desc: "AI 结合知识图谱，从 tweet 推导受益 / 受损 ticker 及逻辑。" },
  { icon: "📈", title: "拉取实时股价", desc: "Finnhub + Alpha Vantage 双数据源，获取当前价格与市值。" },
  { icon: "🚀", title: "多渠道推送", desc: "微信企业机器人 / Telegram 频道 / Email，付费会员 <1 分钟收到。" }
];

const SECTORS = [
  "CPO 共封装光学",
  "Silicon Photonics",
  "光模块",
  "AI GPU",
  "AI ASIC",
  "HBM 存储",
  "先进封装",
  "AI 数据中心",
  "HVDC 电力",
  "液冷散热",
  "AI 服务器",
  "晶圆设备",
  "EDA 软件",
  "机器人",
  "具身智能",
  "自动驾驶",
  "超大规模云厂商"
];
