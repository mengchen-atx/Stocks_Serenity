/**
 * WxPusher UID 登录认证模块
 *
 * 流程：
 * 1. 用户提交 UID → 生成 6 位验证码 → 通过 WxPusher 发到微信
 * 2. 用户提交验证码 → 校验 → 检查是否付费订阅 → 签发 session cookie
 * 3. Dashboard 从 cookie 解密出 UID → 校验付费状态
 */

import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isAdminUid } from "@/lib/admin";
import { decodeSessionToken, encodeSessionToken } from "@/lib/session-token";

const COOKIE_NAME = "wxpusher_session";
const SESSION_DAYS = 7;
const OTP_MINUTES = 10;
const SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-secret";

// ─── OTP ─────────────────────────────────────────────────────────────────────

/** 生成 6 位数字验证码并存入数据库，返回验证码 */
export async function createOtp(uid: string): Promise<string> {
  // 清理该 UID 旧的未使用验证码
  await prisma.wxPusherOtp.deleteMany({ where: { uid, used: false } });

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
  await prisma.wxPusherOtp.create({ data: { uid, code, expiresAt } });
  return code;
}

/** 校验验证码。成功后标记为已使用，返回 true */
export async function verifyOtp(uid: string, code: string): Promise<boolean> {
  const otp = await prisma.wxPusherOtp.findFirst({
    where: {
      uid,
      code,
      used: false,
      expiresAt: { gt: new Date() }
    }
  });
  if (!otp) return false;
  await prisma.wxPusherOtp.update({ where: { id: otp.id }, data: { used: true } });
  return true;
}

// ─── 付费状态校验（WxPusher API）────────────────────────────────────────────

type WxUserRecord = {
  uid: string;
  payEndTime?: number | null; // Unix 毫秒；null 或 0 表示未付费/永久
  subscribeNum?: number;
};

type WxUserResponse = {
  code: number;
  success: boolean;
  data?: {
    records?: WxUserRecord[];
    total?: number;
  };
};

/**
 * 查询 WxPusher 该 UID 是否为付费订阅用户
 * 检查优先级：
 *   1. 管理员 UID → 始终有权限
 *   2. UserChannelAccess 表有记录 → 有权限（管理员手动授权）
 *   3. WxPusher API payEndTime 未来时间 → 有权限（正式付费订阅）
 *
 * 注意：管理员 UID（WXPUSHER_OWNER_UID）始终返回 true
 */
export async function checkWxPusherPayment(uid: string): Promise<{
  isPaid: boolean;
  expiresAt: Date | null;
  isOwner: boolean;
}> {
  // 1. 管理员账号始终有权限（支持多个管理员 UID，逗号分隔）
  if (isAdminUid(uid)) {
    return { isPaid: true, expiresAt: null, isOwner: true };
  }

  // 2. 检查是否已在 UserChannelAccess 表中有未过期的权限
  try {
    const now = new Date();
    const activeAccess = await prisma.userChannelAccess.findFirst({
      where: {
        uid,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { expiresAt: true },
    });
    if (activeAccess) {
      return { isPaid: true, expiresAt: activeAccess.expiresAt, isOwner: false };
    }
  } catch {
    // DB 查询失败时继续走 WxPusher API 路径
  }

  if (!env.WXPUSHER_APP_TOKEN) {
    return { isPaid: false, expiresAt: null, isOwner: false };
  }

  // 3. 查询 WxPusher API 的付费状态
  try {
    const url = `https://wxpusher.zjiecode.com/api/fun/wxuser/v2?appToken=${env.WXPUSHER_APP_TOKEN}&uid=${encodeURIComponent(uid)}`;
    const res = await fetch(url);
    const data = await res.json() as WxUserResponse;

    if (!data.success || !data.data?.records?.length) {
      return { isPaid: false, expiresAt: null, isOwner: false };
    }

    const record = data.data.records[0];
    const payEnd = record.payEndTime;

    // payEndTime = 0 或 null → 未付费
    // payEndTime > now → 付费有效
    if (!payEnd || payEnd <= Date.now()) {
      return { isPaid: false, expiresAt: payEnd ? new Date(payEnd) : null, isOwner: false };
    }

    return { isPaid: true, expiresAt: new Date(payEnd), isOwner: false };
  } catch {
    // API 调用失败时保守处理
    return { isPaid: false, expiresAt: null, isOwner: false };
  }
}

// ─── Session Cookie ───────────────────────────────────────────────────────────

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  expires: Date;
  path: string;
};

/**
 * 返回 session cookie 的 name / value / options，
 * 供调用方直接设到 NextResponse 上（兼容移动端 Safari）。
 */
export function buildSessionCookie(uid: string, days: number = SESSION_DAYS): {
  name: string;
  value: string;
  options: CookieOptions;
} {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return {
    name: COOKIE_NAME,
    value: encodeSessionToken(uid, expiresAt, SECRET),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    },
  };
}

/** 发放 session cookie（登录成功后调用） */
export async function issueSessionCookie(uid: string): Promise<void> {
  const { name, value, options } = buildSessionCookie(uid);
  const cookieStore = await cookies();
  cookieStore.set(name, value, options);
}

/** 清除 session cookie（退出登录） */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** 从 cookie 读取当前登录的 WxPusher UID，未登录或过期返回 null */
export async function getSessionUid(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const decoded = decodeSessionToken(value, SECRET);
  return decoded?.uid ?? null;
}
