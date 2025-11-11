import type { SupportedFrameworks, SupportedRenderers } from 'storybook/internal/types';

export const frameworkToRenderer: Record<
  SupportedFrameworks | SupportedRenderers,
  SupportedRenderers | 'vue'
> = {
  // frameworks
  angular: 'angular',
  ember: 'ember',
  'html-vite': 'html',
  nextjs: 'react',
  'nextjs-vite': 'react',
  'preact-vite': 'preact',
  qwik: 'qwik',
  'react-vite': 'react',
  'react-webpack5': 'react',
  'server-webpack5': 'server',
  solid: 'solid',
  'svelte-vite': 'svelte',
  sveltekit: 'svelte',
  'vue3-vite': 'vue3',
  nuxt: 'vue3',
  'web-components-vite': 'web-components',
  'react-rsbuild': 'react',
  'vue3-rsbuild': 'vue3',
  // renderers
  html: 'html',
  preact: 'preact',
  'react-native': 'react-native',
  'react-native-web-vite': 'react',
  react: 'react',
  server: 'server',
  svelte: 'svelte',
  vue3: 'vue3',
  'web-components': 'web-components',
};
