import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const require = createRequire(import.meta.url);
const projectRoot = dirname(fileURLToPath(import.meta.url));
const playgroundRoot = dirname(require.resolve('@vercel/agent-eval-playground/package.json'));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    '/**': ['./evals/**/*', './results/**/*'],
  },
  typescript: {
    tsconfigPath: 'tsconfig.playground.json',
  },
  transpilePackages: ['@vercel/agent-eval-playground'],
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // playground:build uses --webpack; keep this in sync with tsconfig.playground.json and the route shim checker.
      '@': playgroundRoot,
    };

    return config;
  },
};

export default nextConfig;
