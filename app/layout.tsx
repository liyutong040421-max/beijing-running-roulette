import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "北京跑步轮盘 · 今天去哪跑？",
  description:
    "随机抽一条北京经典跑步路线，跑完顺路探店。奥森、亮马河、温榆河、城市绿心… 25 条路线随机来一发。",
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
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
