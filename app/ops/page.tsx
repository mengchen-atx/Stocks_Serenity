import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { OpsClient } from "./ops-client";

export const dynamic = "force-dynamic";

// 仅管理员可访问，普通用户不知道这个 URL
export default async function OpsPage() {
  const uid = await getSessionUid();
  const ownerUid = process.env.WXPUSHER_OWNER_UID;

  // 未登录 → 去登录
  if (!uid) redirect("/auth/wxpusher");
  // 非 owner → 回 dashboard（不暴露 403，像普通路由一样）
  if (!ownerUid || uid !== ownerUid) redirect("/dashboard");

  return <OpsClient />;
}
