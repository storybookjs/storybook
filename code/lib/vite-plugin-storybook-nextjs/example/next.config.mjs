/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    nextConfigEnv: "next-config-env",
  },
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
};

export default nextConfig;
