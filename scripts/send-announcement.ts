/**
 * 全体广播公告脚本
 * 发送到：Serenity WxPusher 话题（全体订阅用户）+ 所有手动授权用户
 *
 * 运行：npx ts-node -r tsconfig-paths/register scripts/send-announcement.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APP_TOKEN = process.env.WXPUSHER_APP_TOKEN!;
const TOPIC_ID  = process.env.WXPUSHER_TOPIC_ID!;

// ─── 公告内容（HTML）────────────────────────────────────────────────────────

const TITLE = "⚡ 今天，实时推送的价值被验证了一次";

const HTML = `
<div style="font-family:-apple-system,sans-serif;max-width:600px;color:#1a1a1a;">

  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:16px;border-radius:8px 8px 0 0;">
    <div style="font-size:18px;font-weight:bold;">⚡ 今天，实时推送的价值被验证了一次</div>
  </div>

  <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">

    <p style="font-size:14px;line-height:1.8;margin:0 0 12px;">
      今天上午，重点博主 Serenity 发布了一条关于
      <strong>绿的谐波（688017）</strong>
      的深度分析。
    </p>

    <p style="font-size:14px;line-height:1.8;margin:0 0 12px;">
      Serenity Intelligence 在帖子发出后
      <strong>2 分钟内</strong>
      完成抓取、中文翻译、AI 解读，并推送到每一位订阅用户的手机。
    </p>

    <p style="font-size:14px;line-height:1.8;margin:0 0 16px;">
      随后，688017 出现明显异动，<strong>迅速拉升</strong>。
    </p>

    <div style="padding:14px;background:#fef9c3;border-left:4px solid #eab308;border-radius:4px;margin-bottom:16px;">
      <p style="margin:0;font-size:14px;line-height:1.8;">
        我们已经收到反馈——<strong>有两位订阅用户在收到推送后第一时间买入，吃满了这整波涨幅。</strong>
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#78350f;">这不是运气，是信息到达的时间差。</p>
    </div>

    <p style="font-size:14px;line-height:1.8;margin:0 0 4px;">市场上从不缺信息。</p>
    <p style="font-size:14px;line-height:1.8;margin:0 0 12px;">
      真正稀缺的，是<strong>在信息刚刚出现的那一刻就看到它</strong>。
    </p>
    <p style="font-size:13px;color:#555;margin:0 0 4px;">晚五分钟，可能已经追不上了。</p>
    <p style="font-size:13px;color:#555;margin:0 0 16px;">晚半小时，那条消息对你就毫无意义。</p>

    <p style="font-size:14px;font-weight:600;margin:0 0 16px;color:#0f172a;">
      你今天收到了这条推送，下一次也会是第一个知道的人。
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;color:#166534;margin-bottom:10px;">这就是我们在做的事：</div>
      <div style="font-size:13px;line-height:2;color:#166534;">
        ✓ 7×24 小时持续监控重点博主<br/>
        ✓ 新帖发出后 <strong>2 分钟内</strong>自动完成抓取、翻译、AI 解读<br/>
        ✓ 实时推送到手机，无需反复刷屏<br/>
        ✓ 你睡着的时候，它也在帮你盯着
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;color:#1e40af;margin-bottom:8px;">
        目前已覆盖以下博主的实时推送 + Dashboard 展示：
      </div>
      <div style="font-size:13px;color:#1e3a8a;line-height:2;">
        Serenity · Jukan · Degen Trading · Gavin Baker<br/>
        SemiAnalysis · Joseph Carlson · Kova · Citrini
      </div>
      <div style="font-size:12px;color:#3b82f6;margin-top:6px;">8 位重点博主，一个平台全部追踪</div>
    </div>

    <div style="text-align:center;padding:14px;background:#0f172a;border-radius:6px;">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:6px;">续订 / 咨询，联系管理员</div>
      <div style="color:#ffffff;font-weight:700;font-size:16px;">微信 PM112629</div>
      <div style="color:#64748b;font-size:12px;margin-top:8px;">下次机会来的时候，你还在。</div>
    </div>

  </div>
</div>
`.trim();

// ─── 发送函数 ─────────────────────────────────────────────────────────────────

async function sendToTopic() {
  const payload = {
    appToken: APP_TOKEN,
    content: HTML,
    summary: TITLE,
    contentType: 2, // HTML
    topicIds: [Number(TOPIC_ID)],
    verifyPayType: 1, // 只推给付费有效期内的订阅者，过期的不推
  };

  const res = await fetch("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data;
}

async function sendToManualUsers() {
  // 只推给 Serenity 频道的 B类用户（grantedManually=true，微信付款手动授权）
  // 和管理员（expiresAt=null 且 grantedManually=false）
  // A类（WxPusher 主题订阅者）已由话题广播覆盖，不重复推
  const serenityChannel = await prisma.channel.findUnique({ where: { slug: "serenity" } });
  if (!serenityChannel) {
    console.log("⚠️ Serenity 频道未找到，跳过手动用户推送");
    return { skipped: true };
  }

  const accesses = await prisma.userChannelAccess.findMany({
    where: {
      channelId: serenityChannel.id,    // ← 只取 Serenity 频道，不跨频道混发
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        {
          OR: [
            { grantedManually: true },                      // B类：手动授权用户
            { grantedManually: false, expiresAt: null },    // 管理员
          ],
        },
      ],
    },
    select: { uid: true },
    distinct: ["uid"],
  });

  const uids = accesses
    .map((a) => a.uid)
    .filter((uid) => uid.startsWith("UID_"));

  if (uids.length === 0) return { skipped: true };

  const payload = {
    appToken: APP_TOKEN,
    content: HTML,
    summary: TITLE,
    contentType: 2,
    uids,
  };

  const res = await fetch("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("📣 发送公告中...\n");

  // 1. 话题广播（所有订阅用户）
  console.log(`[1/2] 话题广播 → topicId=${TOPIC_ID}`);
  const topicResult = await sendToTopic();
  console.log("话题广播结果:", JSON.stringify(topicResult, null, 2));

  // 2. 手动授权用户（补充未订阅话题但有权限的用户）
  console.log("\n[2/2] 手动授权用户补发...");
  const manualResult = await sendToManualUsers();
  console.log("手动用户结果:", JSON.stringify(manualResult, null, 2));

  console.log("\n✅ 公告发送完毕");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
