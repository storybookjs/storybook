import { findBabelConfigFile } from 'storybook/internal/common';

import type { NextConfig } from 'next';
import { basename } from 'pathe';

export function babelConfigWarning(dir: string, nextConfig: NextConfig): string | undefined {
  const file = findBabelConfigFile(dir);
  if (!file || nextConfig.experimental?.forceSwcTransforms) {
    return undefined;
  }
  return `Storybook ignores your Babel config (\`${basename(file)}\`): it compiles Next.js with SWC only, so Babel plugins don't run in Storybook. Most have a next.config.js equivalent (\`compiler\`, \`experimental.swcPlugins\`). For the others, add the tool's Vite plugin to your Vite config (\`viteFinal\` in Storybook), or set \`experimental.forceSwcTransforms: true\` to hide this warning. See https://storybook.js.org/docs/get-started/frameworks/nextjs-vite#babel`;
}
