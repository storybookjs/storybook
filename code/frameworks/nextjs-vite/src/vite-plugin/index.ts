import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const vitePluginStorybookNextjs = require('vite-plugin-storybook-nextjs');

export const storybookNextJsPlugin = vitePluginStorybookNextjs as typeof vitePluginStorybookNextJs;
