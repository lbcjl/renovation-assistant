import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "装修小助手",
  description: "面向普通业主的家庭装修助手：装修问答、AI 效果图、知识库",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // suppressHydrationWarning: browser extensions (e.g. Immersive Translate)
  // inject attributes on <html> before hydration, which is harmless.
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
