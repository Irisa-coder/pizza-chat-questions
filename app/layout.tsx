import type { Metadata } from "next";
import { GAME_TITLE } from "../lib/event";
import "./globals.css";

export const metadata: Metadata = {
  title: GAME_TITLE + " · Pizza Chat",
  description: "知乎 AI Researcher Club 小聚，留下一问，拼一张披萨。",
  robots: { index: false, follow: false },
  icons: { icon: "/art/pizza-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
