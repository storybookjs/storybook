import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

export * from './types';
export * from './portable-stories';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare module '@storybook/experimental-nextjs-vite/vite-plugin' {
  export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs;
}
