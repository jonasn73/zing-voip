/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/analytics",
        destination: "/dashboard/pay",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
