import type { Metadata, Viewport } from "next";
import { Onest, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "500"], variable: "--font-outfit", display: "swap" });
const onest = Onest({ subsets: ["latin"], weight: ["400"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: "AExpenses",
  description: "Prestação de contas dos cartões corporativos: cada compra classificada por quem fez, conferida pelo financeiro.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AExpenses", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // azul-marinho da Astec
  themeColor: "#00182E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${onest.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
