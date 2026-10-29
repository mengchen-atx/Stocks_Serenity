import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COPY, LANG_COOKIE, parseLang, type Lang } from "./i18n";
import { LangToggle } from "./lang-toggle";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

async function getLang(): Promise<Lang> {
  const store = await cookies();
  return parseLang(store.get(LANG_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[await getLang()];
  return { title: copy.metaTitle, description: copy.metaDescription };
}

const getPlatformStats = unstable_cache(
  async () => {
    const [sources, signals, tickers] = await Promise.all([
      prisma.watchUser.count({ where: { enabled: true } }),
      prisma.tweet.count(),
      prisma.stock.count(),
    ]);
    return { sources, signals, tickers };
  },
  ["login-platform-stats"],
  { revalidate: 600 }
);

const STACK = ["Next.js 15", "TypeScript", "Prisma", "PostgreSQL", "Railway", "Vercel"];

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-teal-400/10 stroke-teal-400/40" strokeWidth="1" />
      <path
        d="M6 20 L11 20 L14 11 L18 23 L21 15 L26 15"
        fill="none"
        className="stroke-teal-300"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const [lang, stats] = await Promise.all([getLang(), getPlatformStats().catch(() => null)]);
  const copy = COPY[lang];

  return (
    <main lang={lang === "zh" ? "zh-CN" : "en"} className="relative flex min-h-screen flex-col overflow-hidden bg-[#05080f] text-slate-200">
      <div aria-hidden="true" className="login-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-teal-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 right-0 h-[420px] w-[420px] rounded-full bg-sky-500/[0.07] blur-3xl"
      />

      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LangToggle lang={lang} />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-12 pt-20 sm:px-6 lg:py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* ── Product story ── */}
        <section className="login-rise">
          <div className="hidden items-center gap-3 lg:flex">
            <LogoMark />
            <span className="text-sm font-semibold tracking-tight text-slate-100">Serenity Intelligence</span>
            <span className="flex items-center gap-1.5 rounded-full border border-teal-400/20 bg-teal-400/5 px-2 py-0.5 text-[11px] font-medium text-teal-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
              </span>
              LIVE
            </span>
          </div>

          <h1 className="text-balance text-3xl lg:mt-8 font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[44px]">
            {copy.headline}
            <span className="mt-3 block text-base font-normal leading-relaxed tracking-normal text-slate-400 sm:text-lg">
              {copy.subhead}
            </span>
          </h1>

          <ol className="mt-10 space-y-0">
            {copy.pipeline.map((step, i) => (
              <li key={step.label} className="relative flex gap-4 pb-5 last:pb-0">
                {i < copy.pipeline.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-gradient-to-b from-teal-400/40 to-white/5" />
                )}
                <span className="relative mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-teal-400/30 bg-[#05080f] font-mono text-[11px] text-teal-300">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{step.label}</p>
                  <p className="text-sm text-slate-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {stats && (
            <dl className="mt-10 grid max-w-md grid-cols-3 divide-x divide-white/5 rounded-xl border border-white/5 bg-white/[0.02]">
              {(
                [
                  [copy.stats.sources, stats.sources],
                  [copy.stats.signals, stats.signals],
                  [copy.stats.tickers, stats.tickers],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="px-4 py-3">
                  <dt className="text-[11px] text-slate-500">{label}</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-slate-100">
                    {formatCount(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 hidden flex-wrap gap-2 sm:flex">
            {STACK.map((tech) => (
              <span key={tech} className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 font-mono text-[11px] text-slate-500">
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* ── Sign in ── */}
        <section className="login-rise login-rise-delay order-first w-full lg:order-none lg:justify-self-end">
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0f1a]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
            <div className="mb-5 lg:hidden">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <span className="text-sm font-semibold tracking-tight text-slate-100">Serenity Intelligence</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{copy.mobileTagline}</p>
            </div>
            <a
              href="/demo"
              className="group flex items-center justify-between rounded-xl border border-teal-400/30 bg-gradient-to-br from-teal-400/15 to-teal-400/[0.03] px-4 py-3.5 transition hover:border-teal-300/60 hover:from-teal-400/25"
            >
              <span>
                <span className="block text-sm font-semibold text-teal-100">{copy.guestTitle}</span>
                <span className="mt-0.5 block text-xs text-teal-200/60">{copy.guestSubtitle}</span>
              </span>
              <svg viewBox="0 0 20 20" className="h-5 w-5 flex-shrink-0 text-teal-300 transition group-hover:translate-x-0.5" aria-hidden="true">
                <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <div className="my-6 flex items-center gap-3 text-[11px] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              {copy.divider}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <LoginForm key={lang} copy={copy.form} />

            <p className="mt-6 text-balance text-center text-xs text-slate-500">
              {copy.footer} <span className="select-all text-slate-400">PM112629</span>
            </p>
          </div>
        </section>
      </div>

      <p className="relative pb-6 text-center text-[11px] tracking-wide text-slate-600">{copy.disclaimer}</p>
    </main>
  );
}
