/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: [
      "http://192.168.5.105:3000",
      "http://localhost:3000",
    ],
  },
};

module.exports = nextConfig;