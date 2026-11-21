import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AExpenses",
    short_name: "AExpenses",
    description: "Prestação de contas dos cartões corporativos",
    start_url: "/app",
    display: "standalone",
    background_color: "#f3f5f9",
    theme_color: "#1f55e6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
