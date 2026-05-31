import { config } from "dotenv";
config({ path: ".env.local" });
import { env } from "../lib/env";

console.log("env.TWITTER_BEARER_TOKEN:", env.TWITTER_BEARER_TOKEN ? "✅ 已加载" : "❌ undefined");
console.log("process.env.TWITTER_BEARER_TOKEN:", process.env.TWITTER_BEARER_TOKEN ? "✅ 已加载" : "❌ undefined");
