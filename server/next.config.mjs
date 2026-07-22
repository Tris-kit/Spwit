/** @type {import('next').NextConfig} */
const nextConfig = {
  // Receipt images arrive as base64 in the OCR proxy body; bump the limit so a
  // ~1100px JPEG (a few hundred KB) doesn't trip the default 1MB action cap.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
