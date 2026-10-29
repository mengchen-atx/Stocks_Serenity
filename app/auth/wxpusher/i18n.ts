export type Lang = "en" | "zh";

export const LANG_COOKIE = "login_lang";
export const DEFAULT_LANG: Lang = "en";

export function parseLang(value: string | undefined): Lang {
  return value === "zh" || value === "en" ? value : DEFAULT_LANG;
}

export type FormCopy = {
  tabUid: string;
  tabPassword: string;
  uidHint: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
  networkError: string;
  /** English mode maps HTTP status to a message; Chinese mode shows the server's own text. */
  errorsByStatus: Partial<Record<number, string>> | null;
  genericError: string;
};

type PageCopy = {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  mobileTagline: string;
  pipeline: ReadonlyArray<{ label: string; detail: string }>;
  stats: { sources: string; signals: string; tickers: string };
  guestTitle: string;
  guestSubtitle: string;
  divider: string;
  footer: string;
  disclaimer: string;
  form: FormCopy;
};

export const COPY: Record<Lang, PageCopy> = {
  en: {
    metaTitle: "Sign in · Serenity Intelligence",
    metaDescription: "Real-time KOL signals from X, analyzed by AI, delivered to WeChat in under a minute.",
    headline: "AI investment intelligence, in real time",
    subhead: "Signals from top investment voices on X, analyzed by AI and delivered to WeChat in under a minute.",
    mobileTagline: "KOL signals → AI analysis → WeChat push",
    pipeline: [
      { label: "X Filtered Stream", detail: "Listens to tracked KOL posts in real time" },
      { label: "Dual-model race", detail: "DeepSeek × MiMo in parallel, first answer wins" },
      { label: "Beneficiary mapping", detail: "Knowledge graph links posts to supply-chain tickers" },
      { label: "WeChat delivery", detail: "From post to push in under a minute" },
    ],
    stats: { sources: "Sources tracked", signals: "Posts analyzed", tickers: "Tickers covered" },
    guestTitle: "Explore as guest",
    guestSubtitle: "No sign-up. One click into a read-only demo.",
    divider: "Subscriber sign in",
    footer: "Stay signed in for 7 days · To subscribe, WeChat:",
    disclaimer: "For information and research only. Not investment advice.",
    form: {
      tabUid: "WxPusher UID",
      tabPassword: "Password",
      uidHint: "Find your UID on the “Me” tab of the WxPusher app.",
      usernameLabel: "Username",
      usernamePlaceholder: "Enter username",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter password",
      submit: "Sign in",
      submitting: "Verifying…",
      success: "Signed in. Opening your dashboard…",
      networkError: "Network error. Check your connection and try again.",
      errorsByStatus: {
        400: "Please check your input. A WxPusher UID starts with UID_.",
        401: "Incorrect username or password.",
        403: "This account has no active subscription.",
      },
      genericError: "Sign-in failed. Please try again.",
    },
  },
  zh: {
    metaTitle: "登录 · Serenity Intelligence",
    metaDescription: "实时追踪 AI 投资 KOL，AI 深度解析，1 分钟内推送到微信。",
    headline: "AI 投资情报终端",
    subhead: "实时追踪 X 上的投资 KOL，AI 深度解析，1 分钟内推送到微信。",
    mobileTagline: "实时 KOL 信号 → AI 解析 → 微信推送",
    pipeline: [
      { label: "X Filtered Stream", detail: "实时监听 KOL 推文" },
      { label: "双模型并行分析", detail: "DeepSeek × MiMo，先返回者胜出" },
      { label: "受益股映射", detail: "知识图谱匹配产业链标的" },
      { label: "微信推送", detail: "从发推到送达 < 1 分钟" },
    ],
    stats: { sources: "追踪博主", signals: "已分析推文", tickers: "覆盖标的" },
    guestTitle: "游客体验",
    guestSubtitle: "无需注册，一键进入只读演示",
    divider: "订阅用户登录",
    footer: "7 天免重新验证 · 订阅请联系 Wx：",
    disclaimer: "内容仅用于信息整理和研究辅助，不构成投资建议。",
    form: {
      tabUid: "WxPusher UID",
      tabPassword: "账号密码",
      uidHint: "在 WxPusher App「我的」页面可以找到你的 UID",
      usernameLabel: "用户名",
      usernamePlaceholder: "输入用户名",
      passwordLabel: "密码",
      passwordPlaceholder: "输入密码",
      submit: "登录",
      submitting: "验证中…",
      success: "登录成功，正在进入 Dashboard…",
      networkError: "网络错误，请检查网络后重试",
      errorsByStatus: null,
      genericError: "登录失败，请稍后再试",
    },
  },
};
