/**
 * 频道权限层
 * 提供「当前用户能访问哪些频道」「某频道某用户有没有权限」等工具函数
 */
import { prisma } from "@/lib/prisma";

export type ChannelInfo = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
};

/** 获取指定 UID 有权访问的所有频道（过滤已过期），按创建时间排序 */
export async function getUserChannels(uid: string): Promise<ChannelInfo[]> {
  const now = new Date();
  const accesses = await prisma.userChannelAccess.findMany({
    where: {
      uid,
      OR: [
        { expiresAt: null },          // 永久授权
        { expiresAt: { gt: now } },   // 未到期
      ],
    },
    include: { channel: true },
    orderBy: { grantedAt: "asc" },
  });
  return accesses.map((a) => ({
    id: a.channel.id,
    slug: a.channel.slug,
    name: a.channel.name,
    description: a.channel.description,
    avatarUrl: a.channel.avatarUrl,
  }));
}

/** 检查某 UID 是否有权访问指定 slug 的频道（过滤已过期），返回频道信息或 null */
export async function checkChannelAccess(
  uid: string,
  channelSlug: string
): Promise<ChannelInfo | null> {
  const now = new Date();
  const access = await prisma.userChannelAccess.findFirst({
    where: {
      uid,
      channel: { slug: channelSlug },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { channel: true },
  });
  if (!access) return null;
  return {
    id: access.channel.id,
    slug: access.channel.slug,
    name: access.channel.name,
    description: access.channel.description,
    avatarUrl: access.channel.avatarUrl,
  };
}

/** 授权某 UID 访问某频道（管理员操作，默认永久） */
export async function grantChannelAccess(
  uid: string,
  channelSlug: string,
  expiresAt?: Date | null
) {
  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) throw new Error(`Channel not found: ${channelSlug}`);
  return prisma.userChannelAccess.upsert({
    where: { uid_channelId: { uid, channelId: channel.id } },
    create: { uid, channelId: channel.id, expiresAt: expiresAt ?? null },
    update: { expiresAt: expiresAt ?? null }, // 更新到期时间（续费场景）
  });
}

/** 撤销某 UID 对某频道的访问权限 */
export async function revokeChannelAccess(uid: string, channelSlug: string) {
  const channel = await prisma.channel.findUnique({ where: { slug: channelSlug } });
  if (!channel) throw new Error(`Channel not found: ${channelSlug}`);
  return prisma.userChannelAccess.deleteMany({
    where: { uid, channelId: channel.id },
  });
}

/** 获取所有频道列表（管理员用） */
export async function getAllChannels(): Promise<ChannelInfo[]> {
  const channels = await prisma.channel.findMany({ orderBy: { createdAt: "asc" } });
  return channels.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    avatarUrl: c.avatarUrl,
  }));
}
