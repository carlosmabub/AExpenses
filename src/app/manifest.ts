import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AExpenses",
    short_name: "AExpenses",
    description: "Prestação de contas dos cartões corporativos",
    start_url: "/app",
    display: "standalone",
    background_color: "#f2edf8",
    theme_color: "#f2edf8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
