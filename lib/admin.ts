/**
 * 管理员 UID 工具
 *
 * WXPUSHER_OWNER_UID 支持逗号分隔的多个 UID：
 *   WXPUSHER_OWNER_UID=UID_xxx,UID_yyy
 *
 * 管理员特权：
 *  - 始终有 dashboard 访问权限，不受付费状态/订阅到期影响
 *  - 始终收到 WxPusher 推送，不受话题订阅限制
 *  - 可访问 /ops 和 /api/admin/* 管理接口
 */

/** 返回所有管理员 UID 列表 */
export function getAdminUids(): string[] {
  const raw = process.env.WXPUSHER_OWNER_UID ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** 判断某个 UID 是否是管理员 */
export function isAdminUid(uid: string): boolean {
  return getAdminUids().includes(uid);
}
