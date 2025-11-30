/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    const base = API_BASE.replace(/\/$/, '');
    return [
      { source: '/auth/:path*', destination: `${base}/auth/:path*` },
      { source: '/posts/:path*', destination: `${base}/posts/:path*` },
      { source: '/feed/:path*', destination: `${base}/feed/:path*` },
      { source: '/stats/:path*', destination: `${base}/stats/:path*` },
      { source: '/user/:path*', destination: `${base}/user/:path*` },
      { source: '/profile/:path*', destination: `${base}/profile/:path*` },
      { source: '/accounts/:path*', destination: `${base}/accounts/:path*` },
      { source: '/tags/:path*', destination: `${base}/tags/:path*` },
    ];
  },
};

export default nextConfig;
