import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { getUserChannels } from "@/lib/channels";
import { AlphaMapClient } from "./alpha-map-client";

export const dynamic = "force-dynamic";

export default async function AlphaMapPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const channels = await getUserChannels(uid);
  if (channels.length === 0) redirect("/dashboard");

  // Use first accessible channel for "Back" nav link
  const firstChannelSlug = channels[0].slug;

  return <AlphaMapClient firstChannelSlug={firstChannelSlug} />;
}
