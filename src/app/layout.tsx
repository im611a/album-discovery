import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE_NAME} · 找到下一张值得完整聆听的专辑`,
  description: "一个轻量、安静的中文音乐专辑发现网站原型。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
