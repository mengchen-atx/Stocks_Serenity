/**
 * WxPusher UID 登录认证模块
 *
 * 流程：
 * 1. 用户提交 UID → 生成 6 位验证码 → 通过 WxPusher 发到微信
 * 2. 用户提交验证码 → 校验 → 检查是否付费订阅 → 签发 session cookie
 * 3. Dashboard 从 cookie 解密出 UID → 校验付费状态
 */

import { createHmac, randomInt } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

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
 * payEndTime 为未来时间 → 付费有效
 * payEndTime 为 null/0/过期 → 未付费
 *
 * 注意：管理员 UID（WXPUSHER_OWNER_UID）始终返回 true
 */
export async function checkWxPusherPayment(uid: string): Promise<{
  isPaid: boolean;
  expiresAt: Date | null;
  isOwner: boolean;
}> {
  // 管理员账号始终有权限
  if (env.WXPUSHER_OWNER_UID && uid === env.WXPUSHER_OWNER_UID) {
    return { isPaid: true, expiresAt: null, isOwner: true };
  }

  if (!env.WXPUSHER_APP_TOKEN) {
    return { isPaid: false, expiresAt: null, isOwner: false };
  }

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

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function encodeCookie(uid: string, expiresAt: Date): string {
  const payload = `${uid}|${expiresAt.getTime()}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

function decodeCookie(value: string): { uid: string; expiresAt: Date } | null {
  try {
    const raw = Buffer.from(value, "base64url").toString();
    const parts = raw.split("|");
    if (parts.length !== 3) return null;
    const [uid, expMs, sig] = parts;
    const payload = `${uid}|${expMs}`;
    if (sign(payload) !== sig) return null;
    const expiresAt = new Date(parseInt(expMs));
    if (expiresAt < new Date()) return null;
    return { uid, expiresAt };
  } catch {
    return null;
  }
}

/** 发放 session cookie（登录成功后调用） */
export async function issueSessionCookie(uid: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const value = encodeCookie(uid, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/"
  });
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
  const decoded = decodeCookie(value);
  return decoded?.uid ?? null;
}
