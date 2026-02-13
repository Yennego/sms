import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
  async rewrites() {
    // In production (Vercel), BACKEND_API_URL is set and API routes handle proxying
    // In development, rewrite /api/v1/* directly to the local backend
    if (process.env.BACKEND_API_URL) {
      return []; // API routes handle proxying in production
    }
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:8000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;

