import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";

async function main() {
  // 直接用批量生成时已验证的正确 profile 内容
  const correctProfile = {
    role: "AI数据中心光学互联核心供应商，利用CPO技术实现高效数据传输",
    segments: ["optical_interconnect"],
    description:
      "Sivers Semiconductor（SIVE）是一家专注于光电技术的半导体公司，核心产品包括硅光子学和共封装光学（CPO）解决方案，用于AI数据中心的高速、低功耗光互联。公司正从客户争取阶段转向产能爬坡期，以满足AI驱动的光互联需求爆发。",
  };

  await prisma.stock.update({
    where: { ticker: "SIVE" },
    data: {
      companyName: "Sivers Semiconductor",
      aiProfile: correctProfile,
    },
  });

  console.log("✅ SIVE 修正完成：companyName = Sivers Semiconductor");
  await prisma.$disconnect();
}
main().catch(console.error);
