import { NextRequest } from "next/server";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { getSessionUid } from "@/lib/wxpusher-auth";
import { checkChannelAccess } from "@/lib/channels";
import { SERENITY_SKILL_SYSTEM_PROMPT } from "@/lib/serenity-skill-prompt";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function unauthorized() {
  return new Response(
    JSON.stringify({ error: "此功能仅对付费订阅用户开放，请先订阅 Serenity。" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return unauthorized();

  const access = await checkChannelAccess(uid, "serenity");
  if (!access) return unauthorized();

  if (!env.XIAOMI_API_KEY) {
    return new Response(JSON.stringify({ error: "聊天服务暂未配置，请联系管理员。" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "请求格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 截断历史和内容长度，防止超出上下文窗口
  const trimmed = messages
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT_LENGTH)
    }));

  const client = new OpenAI({
    apiKey: env.XIAOMI_API_KEY,
    baseURL: env.XIAOMI_BASE_URL ?? "https://token-plan-sgp.xiaomimimo.com/v1"
  });

  const stream = await client.chat.completions.create({
    model: env.XIAOMI_CHAT_MODEL,
    temperature: 0.7,
    stream: true,
    messages: [
      { role: "system", content: SERENITY_SKILL_SYSTEM_PROMPT },
      ...trimmed
    ]
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
