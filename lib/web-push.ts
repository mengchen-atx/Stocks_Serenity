/**
 * Web Push 服务端工具
 * 使用 VAPID 协议向浏览器推送通知
 */
import webpush from "web-push";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL       = process.env.VAPID_EMAIL       ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;         // 点击后跳转的 URL
  channelName?: string; // 频道名，显示在副标题
};

export type PushSubscriptionData = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** 向单个订阅端点发送推送通知，返回是否成功 */
export async function sendWebPushNotification(
  sub: PushSubscriptionData,
  payload: WebPushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 86400 } // 1天内未在线仍可收到
    );
    return { ok: true, gone: false };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    // 410 Gone = 订阅已失效（用户撤销权限），应从 DB 删除
    return { ok: false, gone: status === 410 || status === 404 };
  }
}

/** 批量发送，自动清理失效端点，返回成功数 */
export async function broadcastWebPush(
  subscriptions: (PushSubscriptionData & { id: string })[],
  payload: WebPushPayload,
  onGone: (id: string) => Promise<void>
): Promise<number> {
  let sent = 0;
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const { ok, gone } = await sendWebPushNotification(sub, payload);
      if (ok) { sent++; }
      if (gone) { await onGone(sub.id).catch(() => {}); }
    })
  );
  return sent;
}

export { VAPID_PUBLIC_KEY };
