import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { handleTweet } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest, secret?: string): boolean {
  if (!env.CRON_SECRET) return true;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === env.CRON_SECRET || secret === env.CRON_SECRET;
}

/**
 * POST /api/analyze
 *
 * 手动提交一条推文内容，触发 AI 分析 + WxPusher 推送。
 * 相同内容会通过 contentHash 自动去重，不会重复推送。
 *
 * Body:
 *   content      {string}  推文原文（必填）
 *   sourceUrl    {string}  原推链接（选填，用于"查看原文"按钮）
 *   tweetDate    {string}  推文发布时间 ISO 字符串（选填，默认当前时间）
 *   authorUsername {string} Twitter 用户名，不带 @ （选填，默认 TWITTER_USERNAME）
 *   secret       {string}  等同 Authorization: Bearer，方便网页表单传递
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  或  body.secret = <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    content?: string;
    sourceUrl?: string;
    tweetDate?: string;
    authorUsername?: string;
    secret?: string;
  };

  if (!isAuthorized(request, body.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const authorUsername = body.authorUsername?.trim() || env.TWITTER_USERNAME;
  const tweetDate = body.tweetDate ? new Date(body.tweetDate) : new Date();
  const sourceUrl =
    body.sourceUrl?.trim() || `https://x.com/${authorUsername}`;

  // 生成稳定的 tweetId：同一条推文无论提交多少次，ID 不变 → contentHash 去重生效
  const contentHash = sha256(`${authorUsername}:${content}`);
  const tweetId = `manual_${contentHash.slice(0, 16)}`;

  try {
    const result = await handleTweet(
      { tweetId, authorUsername, content, tweetCreatedAt: tweetDate, sourceUrl },
      undefined // watchUserId — 手动提交不绑定 WatchUser
    );

    return NextResponse.json({
      ok: true,
      tweetId,
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[analyze] handleTweet failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
