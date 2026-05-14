import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "岩签 · 北京岩馆抽签",
    short_name: "岩签",
    description:
      "随机抽一家北京攀岩馆。45 家真实坐标，公平多人模式，爬完一键找补碳。",
    start_url: "/climbing",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf6",
    theme_color: "#ea580c",
    lang: "zh-CN",
    icons: [
      // app/icon.tsx and app/apple-icon.tsx are auto-served by Next at these
      // paths. Keep both PNG and the apple variant so iOS gets the maskable
      // square it expects on the home screen.
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
