import { z } from "zod";

const envSchema = z.object({
  // ─── AI（分析流水线，当前用 DeepSeek v4-flash）────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "anthropic", "gemini"]).default("openai"),
  AI_MODEL: z.string().default("gpt-4o"),

  // ─── 聊天对话（Xiaomi MiMo，供用户交互使用，符合小米套餐条款）──────────
  XIAOMI_API_KEY: z.string().optional(),
  XIAOMI_BASE_URL: z.string().url().optional(),
  XIAOMI_CHAT_MODEL: z.string().default("mimo-v2.6-pro"),

  // ─── Gemini ──────────────────────────────────────────────────────────────────
  GEMINI_API_KEY: z.string().optional(),

  // ─── Twitter ─────────────────────────────────────────────────────────────────
  TWITTER_BEARER_TOKEN: z.string().optional(),
  TWITTER_USERNAME: z.string().default("serenity"),
  TWITTER_INCLUDE_REPLIES: z.coerce.boolean().default(false),
  TWITTER_INCLUDE_RETWEETS: z.coerce.boolean().default(false),
  // When true, cron skips REST timeline polling — stream daemon handles ingestion instead
  TWITTER_STREAM_ENABLED: z.coerce.boolean().default(false),

  // ─── Stock Data ──────────────────────────────────────────────────────────────
  FINNHUB_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),

  // ─── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().optional(),

  // ─── Push Channels ───────────────────────────────────────────────────────────
  WECHAT_WEBHOOK: z.string().optional(),
  SERVER_CHAN_SENDKEY: z.string().optional(),
  WECHAT_TEMPLATE_ENDPOINT: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),

  // ─── WxPusher（个人微信推送，付费订阅产品首选）────────────────────────────
  WXPUSHER_APP_TOKEN: z.string().optional(),   // 应用 Token
  WXPUSHER_TOPIC_ID: z.string().optional(),    // 话题 ID（群发）
  WXPUSHER_OWNER_UID: z.string().optional(),   // 管理员自己的 UID，不受付费验证限制

  // ─── Email (Resend) ──────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Serenity Intelligence <noreply@serenity.ai>"),
  EMAIL_TO_OVERRIDE: z.string().optional(),

  // ─── Auth ────────────────────────────────────────────────────────────────────
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ─── Stripe ──────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_BASIC: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_PREMIUM: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // ─── Notion ──────────────────────────────────────────────────────────────────
  NOTION_API_KEY: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),

  // ─── App ─────────────────────────────────────────────────────────────────────
  CRON_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Serenity Intelligence"),

  // ─── Xiaohongshu automation ──────────────────────────────────────────────────
  // APP_URL: base URL for card screenshots (default: APP_BASE_URL)
  APP_URL: z.string().url().optional(),
  // CARD_SECRET_TOKEN: guards /card/[tweetId] from public access
  CARD_SECRET_TOKEN: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
