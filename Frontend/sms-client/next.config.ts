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
  // The platform operator's pages moved from /super-admin to /platform; old links and bookmarks
  // still work. Sources are anchored at the site root, so they never match the backend API
  // (/api/v1/super-admin/...), which keeps its path.
  async redirects() {
    return [
      { source: '/super-admin', destination: '/platform', permanent: true },
      { source: '/super-admin/:path*', destination: '/platform/:path*', permanent: true },
    ];
  },
  // No /api/v1 rewrites: every backend call goes through the src/app/api/v1/[...path] proxy,
  // which attaches the httpOnly session cookie (BACKEND_API_URL defaults to the local backend).
};

export default nextConfig;

