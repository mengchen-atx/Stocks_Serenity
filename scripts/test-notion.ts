import "dotenv/config";
import { Client } from "@notionhq/client";

const client = new Client({ auth: process.env.NOTION_API_KEY });

async function main() {
  // 1. 检查能否连接数据库，打印原始结构
  try {
    const db = await client.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_ID!
    });
    console.log("✅ 数据库连接成功");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log("原始 properties:", JSON.stringify((db as any).properties, null, 2));
  } catch (e: any) {
    console.error("❌ 数据库连接失败：", e.message);
    return;
  }

  // 2. 尝试写入一条测试记录
  try {
    await client.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID! },
      properties: {
        标题: { title: [{ text: { content: "测试归档 - 可删除" } }] },
        日期: { date: { start: new Date().toISOString() } },
        核心信号: { rich_text: [{ text: { content: "这是一条测试内容" } }] }
      }
    });
    console.log("✅ 写入成功！请去 Notion 数据库确认");
  } catch (e: any) {
    console.error("❌ 写入失败：", e.message);
    console.error("详细：", JSON.stringify(e.body ?? e, null, 2));
  }
}

main();
