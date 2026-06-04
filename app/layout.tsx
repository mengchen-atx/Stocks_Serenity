import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Serenity Intelligence — AI Infra Narrative Terminal",
  description:
    "实时追踪 AI 投资 KOL 观点，AI 深度分析 CPO / 半导体 / AI 电力投资逻辑，自动映射受益股票，1 分钟内推送到微信和 Telegram。",
  openGraph: {
    title: "Serenity Intelligence",
    description: "AI Infra Narrative Terminal for Chinese AI investors.",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <SessionProvider>{children}</SessionProvider>
        <footer style={{
          textAlign: "center",
          padding: "12px 16px",
          fontSize: "11px",
          color: "#64748b",
          borderTop: "1px solid #1e293b",
          background: "#0f172a",
          letterSpacing: "0.01em",
        }}>
          内容仅用于信息整理和研究辅助，不构成投资建议。
        </footer>
      </body>
    </html>
  );
}
