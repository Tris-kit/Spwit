/** @type {import('next').NextConfig} */
const nextConfig = {
  // Receipt images arrive as base64 in the OCR proxy body; bump the limit so a
  // ~1100px JPEG (a few hundred KB) doesn't trip the default 1MB action cap.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  // Serve the exported Expo web app (in public/index.html) at the site root.
  // /api/* and /s/* remain real Next routes and take precedence.
  async rewrites() {
    return [{ source: "/", destination: "/index.html" }];
  },
};

export default nextConfig;
