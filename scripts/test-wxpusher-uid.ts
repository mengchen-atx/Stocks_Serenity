/**
 * 测试直接发送到指定 UID
 * npx tsx --env-file=.env.local scripts/test-wxpusher-uid.ts
 */
import "dotenv/config";

const APP_TOKEN = process.env.WXPUSHER_APP_TOKEN!;
const OWNER_UID = process.env.WXPUSHER_OWNER_UID!;

async function main() {
  console.log(`\nApp Token: ${APP_TOKEN}`);
  console.log(`Owner UID: ${OWNER_UID}\n`);

  const payload = {
    appToken: APP_TOKEN,
    content: "<h3>✅ UID 直推测试</h3><p>如果你看到这条消息，说明 UID 直推配置正确！</p>",
    summary: "WxPusher UID 测试",
    contentType: 2,
    uids: [OWNER_UID]
    // 不带 verifyPayType
  };

  console.log("发送 payload:", JSON.stringify(payload, null, 2));

  const res = await fetch("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = await res.text();
  console.log("\n完整响应:");
  console.log(JSON.stringify(JSON.parse(body), null, 2));
}

main().catch(console.error);
