import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/tweets
 * Returns recent tweets with AI analysis, supporting pagination and filtering.
 *
 * Query params:
 *   limit  — number of results (default 20, max 100)
 *   cursor — cursor-based pagination (tweet.id)
 *   ticker — filter by mentioned ticker
 *   author — filter by author username
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 20), 100);
  const cursor = params.get("cursor") ?? undefined;
  const ticker = params.get("ticker")?.toUpperCase() ?? undefined;
  const author = params.get("author") ?? undefined;

  const stockFilter = ticker
    ? {
        stockMentions: {
          some: { stock: { ticker } }
        }
      }
    : {};

  const authorFilter = author ? { authorUsername: author } : {};

  const tweets = await prisma.tweet.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    where: { ...stockFilter, ...authorFilter },
    orderBy: { tweetCreatedAt: "desc" },
    include: {
      stockMentions: {
        include: { stock: { select: { ticker: true, companyName: true, price: true } } }
      }
    }
  });

  const hasMore = tweets.length > limit;
  const items = tweets.slice(0, limit);
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    items,
    nextCursor,
    hasMore
  });
}
