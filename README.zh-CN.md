# Serenity Intelligence（中文说明）

**实时 AI 投资情报平台。** 系统实时追踪 X 上 17 位投资和 AI 基础设施领域的博主，用大模型完成翻译、摘要和看多/看空标的提取。分析结果展示在 Web Dashboard 上，并推送到订阅用户的微信，一般在原帖发布后 1 分钟内送达。

这是一个正在运营、有付费用户的真实产品，由我独立设计、开发和运维。

**🔗 线上地址：[alphaline.fit](https://www.alphaline.fit)**。点击 **「游客体验」** 即可免注册进入只读演示。

![Dashboard](docs/images/dashboard.png)

## 关键数据

| | |
|---|---|
| 追踪信息源 | 17 个 X 账号，每个对应一个频道 |
| 已采集并分析的推文 | 9,000+ 条，自 2026 年 5 月起，登录页有实时计数 |
| 覆盖标的 | 1,300+ |
| 客户 | 累计 100+ 付费订阅用户 |
| LLM 鲁棒性测试 | 两轮共 152 / 152 通过（[报告](docs/benchmarks/)） |

## 架构

1. **采集：** Railway 上的常驻进程连接 X Filtered Stream，把每条推文转发到需要鉴权的 ingest 接口。另保留一套定时 REST 轮询作为备用模式，轮询频率按博主活跃度自动调整。
2. **分析：** DeepSeek 与小米 MiMo 通过 `Promise.any` 并行请求，取第一个通过校验的结果。
3. **存储与分发：** 分析结果和股票提及写入 PostgreSQL，再按频道把格式化后的消息推送到订阅用户的微信。
4. **阅读：** 服务端渲染的 Dashboard，包括推文流、30 天股票提及榜、D3 力导向「Alpha Map」、供应链视图和流式 AI 研究助手。

## 工程亮点

- **稳健的流式采集：** 心跳看门狗，40 秒收不到心跳就重连；指数退避，从 1 秒逐步拉长到 5 分钟；每 5 分钟同步一次规则。遇到 API 欠费这类致命错误时停止重试，并通过微信通知管理员。
- **LLM 结构化输出的可靠性：** 双模型并行，先返回者胜出。模型输出依次经过状态机清洗（处理字符串内的换行、中文弯引号和全角引号）、`jsonrepair` 修复和 Zod 校验。模型全部失败时，降级推送推文原文。
- **去重与推送记录：** 按推文 ID 和「作者 + 内容」的 SHA-256 哈希去重。推送按「推文 × 渠道 × 内容哈希」记录，重试和补发时会跳过已发送的消息。
- **鉴权与权限：**
  - 会话 Cookie 用 HMAC-SHA256 签名，并做恒定时间比较。
  - 按频道授权，带到期时间。
  - 游客模式只读，内容延迟 24 小时，不触发付费的 AI 调用。
  - Dashboard 路由有滑动窗口限流，防爬虫。
- **前端：** Next.js 15 App Router + React Server Components，用 `unstable_cache` 缓存聚合查询；D3 力导向图；登录页支持中英双语。

## 本地运行与测试

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
npm run prisma:migrate
npm run dev

npm run lint && npm run typecheck && npm test
```

每次 push 或提 PR，GitHub Actions 都会自动运行 lint、类型检查和单元测试。

## 免责声明

内容仅用于信息整理和研究辅助，不构成投资建议。

---

[English](README.md)
