import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AExpenses",
  description: "Prestação de contas dos cartões corporativos",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AExpenses", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f55e6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
