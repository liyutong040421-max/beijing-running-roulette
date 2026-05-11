import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "北京跑步轮盘 · 今天去哪跑？",
  description:
    "随机抽一条北京跑步路线，二环、绿道、运河、奥森、亮马河、温榆河… 从日常长线到挑战路线随机来一发。",
  openGraph: {
    title: "北京跑步轮盘 · 今天去哪跑？",
    description: "随机抽一条北京路线，跑完顺路探店。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "北京跑步轮盘 · 今天去哪跑？",
    description: "随机抽一条北京路线，跑完顺路探店。",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fff7ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
