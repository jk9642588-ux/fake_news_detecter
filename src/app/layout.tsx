import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fake News Detector",
  description: "Verify news claims, articles, and videos against trusted sources, fact-checkers, and live coverage.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
