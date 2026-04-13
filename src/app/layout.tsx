import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YZ-Ops AI — 亚马逊电商智能运营中枢",
  description: "AI辅助决策系统，广告调优与选品决策",
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
