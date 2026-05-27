# Serenity Intelligence

> **AI Infra Narrative Terminal** — 实时追踪 AI 投资 KOL 观点，AI 深度分析投资逻辑，自动映射受益股票，1 分钟内推送到微信、Telegram 和邮件。

## 功能概览

| 功能 | 描述 |
|------|------|
| 🔍 实时监控 | 每分钟轮询 @serenity 推文，自动去重 |
| 🧠 AI 分析 | GPT-4o / Claude 4 结合知识图谱，推导受益 ticker |
| 📈 股票数据 | Finnhub + Alpha Vantage 实时价格、市值、行业 |
| 🚀 多渠道推送 | 微信企业机器人 / Telegram / Email，<1 分钟 |
| 💳 订阅收费 | Stripe 月费制，Free/Basic(¥39)/Pro(¥99)/Premium(¥199) |
| 📊 Dashboard | 实时 Feed、股票热度榜、Narrative Tag Cloud |

## 技术栈

- **Frontend**: Next.js 15 / React 19 / TypeScript / TailwindCSS
- **Backend**: Node.js / Prisma ORM / PostgreSQL
- **AI**: OpenAI GPT-4o / Anthropic Claude 4
- **Auth**: NextAuth.js (Google OAuth + Email Magic Link)
- **Payment**: Stripe Subscription
- **Push**: 企业微信 / Telegram Bot / Resend Email
- **Deploy**: Vercel + Supabase/Railway

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少配置 OPENAI_API_KEY、TWITTER_BEARER_TOKEN、DATABASE_URL
```

### 3. 初始化数据库

```bash
npx prisma migrate dev --name init
```

### 4. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3000
```

---

## 部署方案

### 方案 A：Vercel + Supabase（推荐）

1. 创建 [Supabase](https://supabase.com) 项目，复制 Pooler 连接字符串为 `DATABASE_URL`
2. `vercel` 部署，在 Dashboard 配置所有环境变量
3. `DATABASE_URL=... npx prisma migrate deploy` 初始化数据库
4. vercel.json 已配置每分钟 Cron（需 Vercel Pro 计划）

### 方案 B：Railway

New Project → Deploy from GitHub Repo，添加 PostgreSQL，配置环境变量，自动识别 Dockerfile。

### 方案 C：Docker 自托管

```bash
docker-compose up -d
```

---

## Stripe 配置

1. 创建 3 个订阅产品（¥39/¥99/¥199/月）
2. 复制 Price ID 到 `STRIPE_PRICE_BASIC/PRO/PREMIUM`
3. 配置 Webhook → `https://your-domain.com/api/webhooks/stripe`
   - 事件：`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. 复制 Webhook Secret 到 `STRIPE_WEBHOOK_SECRET`

---

## API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/cron` | GET | 触发完整 Pipeline |
| `/api/analyze` | POST | 分析单条推文 |
| `/api/tweets` | GET | 获取推文列表（分页/筛选）|
| `/api/subscription` | GET/POST | 订阅状态 / 创建 Checkout |
| `/api/webhooks/stripe` | POST | Stripe Webhook |
| `/api/push/telegram` | POST | 手动推送 Telegram |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 认证 |

---

## 目录结构

```
serenity/
├── app/
│   ├── page.tsx              # Landing page
│   ├── pricing/page.tsx      # 订阅方案
│   ├── dashboard/page.tsx    # 主 Dashboard
│   ├── settings/page.tsx     # 账号设置
│   └── api/                  # API Routes
├── components/
├── lib/
│   ├── ai.ts                 # AI 分析（OpenAI/Anthropic）
│   ├── knowledge-graph.ts    # AI Infra 知识图谱
│   ├── pipeline.ts           # 主流程编排
│   ├── stripe.ts             # Stripe 订阅
│   ├── telegram.ts           # Telegram 推送
│   ├── email.ts              # Email 推送（Resend）
│   ├── twitter.ts            # Twitter API v2
│   └── wechat.ts             # 微信推送
└── prisma/schema.prisma      # 完整数据模型
```

---

MIT License © 2025 Serenity Intelligence
