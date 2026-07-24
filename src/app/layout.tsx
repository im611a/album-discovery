import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/site";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { RouteMotion } from "@/components/editorial/route-motion";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${SITE_NAME} · 找到下一张值得完整聆听的专辑`, template: `%s · ${SITE_NAME}` },
  description: "表达你的聆听偏好，获得有理由的真实专辑推荐，并建立只属于本机的专辑清单。",
  openGraph: { siteName: SITE_NAME, locale: "zh_CN", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><RouteMotion /><PersonalStateProvider>{children}</PersonalStateProvider></body>
    </html>
  );
}
