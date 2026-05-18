import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketScout",
  description: "AI Market Intelligence Dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
