import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy GTM through our own domain so domain-based ad blockers
    // (uBlock Origin, Ghostery) cannot match www.googletagmanager.com.
    // Query strings (e.g. ?id=GTM-XXXXX) are forwarded automatically.
    return [
      {
        source: "/favicon.ico",
        destination: "/assets/brand/favicon.svg",
      },
      {
        source: "/gtm/:path*",
        destination: "https://www.googletagmanager.com/:path*",
      },
    ];
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol:
          (process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL as "http" | "https") ||
          "https",
        hostname: "" + process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST,
      },
    ],
    // Skip image optimization for local development (private IP)
    unoptimized: process.env.NODE_ENV === "development",
  },
};

export default withBundleAnalyzer(nextConfig);
