import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { isAdminUid } from "@/lib/admin";
import { OpsClient } from "./ops-client";

export const dynamic = "force-dynamic";

// 仅管理员可访问，普通用户不知道这个 URL
export default async function OpsPage() {
  const uid = await getSessionUid();

  // 未登录 → 去登录
  if (!uid) redirect("/auth/wxpusher");
  // 非管理员 → 回 dashboard（不暴露 403，像普通路由一样）
  if (!isAdminUid(uid)) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", color: "#e2e8f0" }}>
      <OpsClient uid={uid} />
    </div>
  );
}
