/**
 * 致歉公告脚本 — 关于 .HK / .SZ 股票代码被 X 误判为链接导致推送缺失的问题
 * 发送到：Serenity WxPusher 话题（全体订阅用户）+ 所有手动授权用户
 *
 * 运行：npx ts-node -r tsconfig-paths/register scripts/send-apology-announcement.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APP_TOKEN = process.env.WXPUSHER_APP_TOKEN!;
const TOPIC_ID  = process.env.WXPUSHER_TOPIC_ID!;

// ─── 公告内容（HTML）────────────────────────────────────────────────────────

const TITLE = "🙏 关于今天港股/A股代码推送缺失的说明与修复";

const HTML = `
<div style="font-family:-apple-system,sans-serif;max-width:600px;color:#1a1a1a;">

  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:16px;border-radius:8px 8px 0 0;">
    <div style="font-size:18px;font-weight:bold;">🙏 关于今天部分股票代码推送缺失的说明</div>
  </div>

  <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">

    <p style="font-size:14px;line-height:1.8;margin:0 0 12px;">
      有细心的朋友发现，今天推送的一条「800V DC 相关标的清单」里，
      <strong>2577.HK</strong> 和 <strong>300376.SZ</strong> 这两个代码不见了。
      在这里跟大家说明一下原因，并致歉。
    </p>

    <div style="padding:14px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;color:#991b1b;margin-bottom:6px;">问题原因</div>
      <p style="margin:0;font-size:13px;line-height:1.8;color:#7f1d1d;">
        原推文里写的是 <strong>2577.HK</strong>（港股代码，.HK 即「香港交易所」）和
        <strong>300376.SZ</strong>（A股代码，.SZ 即「深圳证券交易所」）。
        问题在于，<strong>.HK</strong> 和 <strong>.SZ</strong> 这两个后缀恰好同时也是互联网上合法的「国家顶级域名」后缀——
        X / Twitter 的链接自动识别机制把这两个股票代码误判成了网址，
        自动转换成了 <strong>t.co</strong> 短链接。我们的抓取流程在还原文本时，
        把这部分内容当作「链接」处理掉了，导致这两个代码在推送和网站展示中都消失了。
      </p>
    </div>

    <div style="padding:14px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;color:#166534;margin-bottom:6px;">现状</div>
      <p style="margin:0;font-size:13px;line-height:1.8;color:#14532d;">
        我们已经完成修复并调试验证——现在系统能够正确识别并保留这类「形似域名」的港股 / A股代码
        （如 <strong>.HK</strong> / <strong>.SZ</strong> / <strong>.SS</strong> 等），
        不会再被误判成链接吞掉。<strong>这条问题不会再出现。</strong>
      </p>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px;margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;color:#1e40af;margin-bottom:10px;">借这个机会，我们也同步做了两项升级：</div>
      <div style="font-size:13px;color:#1e3a8a;line-height:2;">
        ① 抓取频率进一步提速 — 从原来的 <strong>每 2 分钟</strong>一次，提升到<strong>每 1 分钟</strong>一次，第一时间触达大家<br/>
        ② AI 识别中国 A股标的的能力增强 — 之后帖子里出现 A股代码时，会有更明显、更准确的提示和标注
      </div>
    </div>

    <p style="font-size:13px;line-height:1.8;color:#555;margin:0 0 16px;">
      感谢大家的反馈和耐心。我们深知产品还有很多可以打磨的地方——
      如果你发现任何<strong>问题或不足</strong>（无论是推送遗漏、翻译不准、网站展示，还是其他任何体验上的小细节），
      都欢迎随时告诉我们，我们会持续改进、绝不含糊。
    </p>

    <div style="text-align:center;padding:14px;background:#0f172a;border-radius:6px;">
      <div style="color:#94a3b8;font-size:12px;margin-bottom:6px;">问题反馈 / 续订咨询，联系管理员</div>
      <div style="color:#ffffff;font-weight:700;font-size:16px;">微信 PM112629</div>
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
  const serenityChannel = await prisma.channel.findUnique({ where: { slug: "serenity" } });
  if (!serenityChannel) {
    console.log("⚠️ Serenity 频道未找到，跳过手动用户推送");
    return { skipped: true };
  }

  const accesses = await prisma.userChannelAccess.findMany({
    where: {
      channelId: serenityChannel.id,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        {
          OR: [
            { grantedManually: true },
            { grantedManually: false, expiresAt: null },
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
  console.log("📣 发送致歉公告中...\n");

  console.log(`[1/2] 话题广播 → topicId=${TOPIC_ID}`);
  const topicResult = await sendToTopic();
  console.log("话题广播结果:", JSON.stringify(topicResult, null, 2));

  console.log("\n[2/2] 手动授权用户补发...");
  const manualResult = await sendToManualUsers();
  console.log("手动用户结果:", JSON.stringify(manualResult, null, 2));

  console.log("\n✅ 致歉公告发送完毕");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
