import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { getUserChannels } from "@/lib/channels";

export const dynamic = "force-dynamic";

export default async function DashboardIndexPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const channels = await getUserChannels(uid);

  if (channels.length === 0) {
    // 无任何频道权限，显示提示
    return (
      <div className="min-h-screen bg-[#070d1a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">您尚未订阅任何频道</p>
          <p className="text-slate-600 text-xs">请联系管理员开通权限</p>
        </div>
      </div>
    );
  }

  // 重定向到第一个有权限的频道
  redirect(`/dashboard/${channels[0].slug}`);
}
