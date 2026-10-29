import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { SiteFooter } from "@/components/SiteFooter";

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
        <SessionProvider>
          {children}
          <ChatWidget />
        </SessionProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
