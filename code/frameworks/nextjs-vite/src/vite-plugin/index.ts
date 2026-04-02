import { createRequire } from 'node:module';
import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

const require = createRequire(import.meta.url);

const vitePluginStorybookNextjs =
  require('vite-plugin-storybook-nextjs') as typeof vitePluginStorybookNextJs;

export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs = vitePluginStorybookNextjs;
