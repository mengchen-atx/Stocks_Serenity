import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { getUserChannels } from "@/lib/channels";
import { SupplyChainClient } from "./supply-chain-client";

export const dynamic = "force-dynamic";

export default async function SupplyChainPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/auth/wxpusher");

  const channels = await getUserChannels(uid);
  if (channels.length === 0) redirect("/dashboard");

  const firstChannelSlug = channels[0].slug;

  return <SupplyChainClient firstChannelSlug={firstChannelSlug} />;
}
