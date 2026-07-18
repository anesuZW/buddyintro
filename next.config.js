/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    outputFileTracingIncludes: {
      "/*": ["./node_modules/.prisma/client/**/*"],
      "/api/**/*": ["./node_modules/.prisma/client/**/*"],
    },
  },
};

module.exports = nextConfig;
