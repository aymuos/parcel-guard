import type { NextConfig } from "next";

const devOrigins = (
  process.env.FRONTEND_DEV_ORIGINS ??
  "localhost,127.0.0.1,192.168.1.34,192.168.1.36"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
