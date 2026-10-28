import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Allow common image domains
    domains: ['www.google.com', 'www.vecteezy.com', 'picsum.photos', 'public.blob.vercel-storage.com', 'blob.vercel-storage.com', 'images.unsplash.com'],
    // Allow any https remote image for tenant logos
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // No /api/v1 rewrites: every backend call goes through the src/app/api/v1/[...path] proxy,
  // which attaches the httpOnly session cookie (BACKEND_API_URL defaults to the local backend).
};

export default nextConfig;

