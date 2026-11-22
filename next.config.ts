import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As migrações SQL são lidas em tempo de execução; inclui a pasta no pacote da Vercel
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
