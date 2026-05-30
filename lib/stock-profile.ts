/**
 * AI 供应链供应链分析
 *
 * 根据股票 ticker 和已有的推文分析数据，用 AI 生成：
 * 1. 公司简介（中文，2-3句）
 * 2. 在 AI 供应链中的位置（可多个）
 */

import OpenAI from "openai";
import { env } from "@/lib/env";

// ─── 供应链定义 ────────────────────────────────────────────────────────────────

export type SupplyChainSegment = {
  id: string;
  label: string;
  emoji: string;
  desc: string;
};

export const SUPPLY_CHAIN: SupplyChainSegment[] = [
  { id: "raw_materials",        label: "原材料",      emoji: "⛏️",  desc: "化合物半导体、稀土、特种气体" },
  { id: "substrate",            label: "衬底/晶圆",   emoji: "🪨",  desc: "硅晶圆、GaAs、InP、SiC衬底" },
  { id: "chip_design",          label: "芯片设计",    emoji: "🎨",  desc: "GPU / CPU / AI加速器设计" },
  { id: "chip_fab",             label: "晶圆代工",    emoji: "🏭",  desc: "芯片制造、光刻、蚀刻" },
  { id: "packaging",            label: "封装测试",    emoji: "📦",  desc: "先进封装、CoWoS、HBM、测试" },
  { id: "optical_interconnect", label: "光学互联",    emoji: "💡",  desc: "硅光子、共封装光学CPO、激光器" },
  { id: "networking",           label: "网络设备",    emoji: "🔌",  desc: "以太网交换、InfiniBand、网络芯片" },
  { id: "server_system",        label: "服务器整机",  emoji: "🖥️",  desc: "AI服务器、存储系统" },
  { id: "data_center",          label: "数据中心",    emoji: "🏢",  desc: "超大规模云基础设施" },
  { id: "ai_software",          label: "AI软件/模型", emoji: "🤖",  desc: "大语言模型、AI框架、MLOps" },
];

export type StockAiProfile = {
  description: string;   // 公司简介，2-3句中文
  role: string;          // 一句话角色定位
  segments: string[];    // 所属供应链环节 id 列表
};

// ─── AI 生成 ───────────────────────────────────────────────────────────────────

export async function generateStockProfile(
  ticker: string,
  companyName: string | null,
  reasons: string[]  // 来自推文分析的 mention reasons，作为上下文
): Promise<StockAiProfile> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {})
  });

  const segmentOptions = SUPPLY_CHAIN.map(
    (s) => `- ${s.id}: ${s.label}（${s.desc}）`
  ).join("\n");

  const context = reasons.length > 0
    ? `\n\n来自推文分析的已知信息：\n${reasons.slice(0, 5).map((r) => `• ${r}`).join("\n")}`
    : "";

  const prompt = `你是 AI 基础设施和半导体供应链专家。请分析以下公司并返回 JSON。

公司：${ticker}${companyName ? `（${companyName}）` : ""}${context}

AI 供应链环节选项（可多选，选最匹配的）：
${segmentOptions}

返回严格 JSON，不要 markdown：
{
  "description": "2-3句中文简介，说明公司主营业务和核心产品",
  "role": "一句话定位，例如：AI数据中心光学互联核心供应商",
  "segments": ["segment_id1", "segment_id2"]
}`;

  const completion = await client.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }]
  });

  const raw = completion.choices[0]?.message.content ?? "";

  // 提取 JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI returned no JSON");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<StockAiProfile>;
  return {
    description: parsed.description ?? "",
    role: parsed.role ?? "",
    segments: Array.isArray(parsed.segments) ? parsed.segments : []
  };
}
