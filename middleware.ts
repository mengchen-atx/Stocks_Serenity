/**
 * Next.js Middleware — 请求限流（防爬虫）
 *
 * 保护 /dashboard/* 路由：
 *   - 每个 UID 每分钟最多 WINDOW_MAX 次请求
 *   - 超限返回 429，页面显示友好提示
 *   - 正常用户（翻页、刷新）不会触发
 *   - 自动爬虫脚本必然触发
 *
 * 实现：内存滑动窗口（每个 Vercel 实例独立）
 * Fluid Compute 下实例会被复用，防护效果显著。
 */

import { NextRequest, NextResponse } from "next/server";

// ─── 配置 ────────────────────────────────────────────────────────────────────

/** 滑动窗口时长（毫秒）*/
const WINDOW_MS = 60_000; // 1 分钟

/** 窗口内最大请求数 */
const WINDOW_MAX = 120;

/** 触发限流后封禁时长（毫秒）*/
const BLOCK_MS = 5 * 60_000; // 5 分钟

// ─── 内存存储 ─────────────────────────────────────────────────────────────────

type RateRecord = {
  count: number;
  windowStart: number;
  blockedUntil?: number;
};

// uid/ip → 访问记录
const store = new Map<string, RateRecord>();

// 每5分钟清理过期记录，防止内存泄漏
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return;
  lastCleanup = now;
  for (const [key, rec] of store) {
    const isExpired =
      now - rec.windowStart > WINDOW_MS &&
      (!rec.blockedUntil || now > rec.blockedUntil);
    if (isExpired) store.delete(key);
  }
}

// ─── 限流检查 ─────────────────────────────────────────────────────────────────

function check(key: string): { allowed: boolean; retryAfterSec: number } {
  maybeCleanup();
  const now = Date.now();
  const rec = store.get(key);

  // 在封禁期内
  if (rec?.blockedUntil && now < rec.blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.blockedUntil - now) / 1000) };
  }

  // 新窗口或窗口已过期
  if (!rec || now - rec.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }

  rec.count++;

  // 超出限制 → 进入封禁
  if (rec.count > WINDOW_MAX) {
    rec.blockedUntil = now + BLOCK_MS;
    store.set(key, rec);
    return { allowed: false, retryAfterSec: Math.ceil(BLOCK_MS / 1000) };
  }

  store.set(key, rec);
  return { allowed: true, retryAfterSec: 0 };
}

// ─── 从 cookie 提取 UID（不验签，仅用于限流 key）────────────────────────────

function extractUidFromCookie(cookieValue: string): string | null {
  try {
    // cookie 格式：base64url(uid|expiresMs|hmac)
    const raw = Buffer.from(cookieValue, "base64url").toString("utf-8");
    const uid = raw.split("|")[0];
    return uid?.startsWith("UID_") || uid?.startsWith("PWD_") || uid?.startsWith("GUEST_") ? uid : null;
  } catch {
    return null;
  }
}

// ─── 管理员白名单（永不限流）────────────────────────────────────────────────

const ADMIN_UIDS = new Set([
  "UID_JfTkKsh07ov6KpPKFVXP895RAECI",
  "UID_eCpIlFx80mXiZMtzxaqM2OwNG1kJ",
  // 也从环境变量读取，支持动态扩展
  ...(process.env.WXPUSHER_OWNER_UID ?? "").split(",").map((s) => s.trim()).filter(Boolean),
]);

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  // 从 session cookie 取 UID，作为限流 key
  const cookieVal = req.cookies.get("wxpusher_session")?.value;
  const uid = cookieVal ? extractUidFromCookie(cookieVal) : null;

  // 未登录用户：不限流（登录页本身不包含内容，靠服务端鉴权挡内容）
  if (!uid) return NextResponse.next();

  // 管理员永不限流
  if (ADMIN_UIDS.has(uid)) return NextResponse.next();

  const { allowed, retryAfterSec } = check(uid);

  if (!allowed) {
    // 返回 429，浏览器会看到这个页面
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title>请求过于频繁</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#070d1a;color:#94a3b8;}
.box{text-align:center;padding:40px;border:1px solid #1e293b;border-radius:12px;background:#0d1628;max-width:360px;}
h1{color:#f87171;font-size:20px;margin-bottom:8px;}p{font-size:14px;line-height:1.6;margin:0 0 16px;}
small{color:#475569;font-size:12px;}</style></head>
<body><div class="box">
  <h1>⚠️ 请求过于频繁</h1>
  <p>您的请求速度超出正常范围。<br>请 ${Math.ceil(retryAfterSec / 60)} 分钟后再试。</p>
  <small>如有疑问，请联系管理员 Wx：PM112629</small>
</div></body></html>`,
      {
        status: 429,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  // 只保护 dashboard 内容页，排除静态资源和 API
  matcher: ["/dashboard/:path*"],
};
