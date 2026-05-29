/**
 * Notion 归档模块
 * 将每条 AI 分析结果写入 Notion 数据库，建立可检索的历史档案
 */

import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AiAnalysis } from "@/types";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) _client = new Client({ auth: env.NOTION_API_KEY });
  return _client;
}

// ─── 公共入口 ─────────────────────────────────────────────────────────────────

/**
 * 将一条分析结果归档到 Notion 数据库
 * @param title    标题列 — 推文作者 + 核心 Ticker
 * @param content  核心信号列 — 完整的中文分析文本
 */
export async function saveToNotionArchive(
  title: string,
  content: string
): Promise<void> {
  if (!env.NOTION_API_KEY || !env.NOTION_DATABASE_ID) {
    logger.debug("Notion not configured, skipping archive");
    return;
  }

  try {
    await getClient().pages.create({
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: {
        // 标题列（Title 类型）
        标题: {
          title: [{ text: { content: title } }]
        },
        // 日期列（Date 类型）
        日期: {
          date: { start: new Date().toISOString() }
        },
        // 核心信号列（Rich Text 类型）
        核心信号: {
          rich_text: [
            {
              text: {
                // Notion rich_text 单块上限 2000 字符，超出截断
                content: content.slice(0, 2000)
              }
            }
          ]
        }
      }
    });

    logger.info({ title }, "Notion archive saved");
    console.log(`✅ Notion 归档成功：${title}`);
  } catch (err) {
    // 写入失败不影响主流程
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "Notion archive failed");
    console.error(`⚠️ Notion 归档失败（不影响推送）：${msg}`);
  }
}

// ─── 辅助：从 AiAnalysis 构建 title 和 content ───────────────────────────────

/**
 * 从 AI 分析结果构建 Notion 标题
 * 格式：@作者 · 📈 MRVL SIVI  （最多列 5 个 Ticker）
 */
export function buildNotionTitle(authorUsername: string, analysis: AiAnalysis): string {
  const bullish = analysis.bullish_stocks.slice(0, 3).map((s) => s.ticker);
  const bearish = analysis.bearish_stocks.slice(0, 2).map((s) => s.ticker);
  const parts: string[] = [`@${authorUsername}`];
  if (bullish.length > 0) parts.push(`📈 ${bullish.join(" ")}`);
  if (bearish.length > 0) parts.push(`📉 ${bearish.join(" ")}`);
  return parts.join(" · ");
}

/**
 * 从 AI 分析结果构建 Notion 核心信号内容
 * 纯文本，方便在 Notion 里全文搜索
 */
export function buildNotionContent(analysis: AiAnalysis): string {
  const lines: string[] = [];

  if (analysis.translated_content_cn) {
    lines.push("【中文翻译】");
    lines.push(analysis.translated_content_cn);
    lines.push("");
  }

  lines.push("【AI 解读】");
  lines.push(analysis.summary_cn);
  lines.push("");

  if (analysis.bullish_stocks.length > 0) {
    lines.push("【利好股票】");
    for (const s of analysis.bullish_stocks) {
      lines.push(`• ${s.ticker}（${s.company}）：${s.reason}`);
    }
    lines.push("");
  }

  if (analysis.bearish_stocks.length > 0) {
    lines.push("【利空股票】");
    for (const s of analysis.bearish_stocks) {
      lines.push(`• ${s.ticker}（${s.company}）：${s.reason}`);
    }
    lines.push("");
  }

  if (analysis.sector_tags.length > 0) {
    lines.push(`【标签】${analysis.sector_tags.join(" / ")}`);
  }

  lines.push(`【置信度】${analysis.confidence}%`);

  return lines.join("\n");
}
