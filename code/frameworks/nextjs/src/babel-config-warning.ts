import { basename } from 'node:path';

import { findBabelConfigFile } from 'storybook/internal/common';

import type { NextConfig } from 'next';

export function babelConfigWarning(dir: string, nextConfig: NextConfig): string | undefined {
  const file = findBabelConfigFile(dir);
  if (!file || nextConfig.experimental?.forceSwcTransforms) {
    return undefined;
  }
  return `Storybook ignores your Babel config (\`${basename(file)}\`): it compiles Next.js with SWC only, so Babel plugins don't run in Storybook. Most have a next.config.js equivalent (\`compiler\`, \`experimental.swcPlugins\`). For the others, run the plugin with a \`babel-loader\` rule in \`webpackFinal\`, or set \`experimental.forceSwcTransforms: true\` to hide this warning. See https://storybook.js.org/docs/get-started/frameworks/nextjs#babel`;
}
