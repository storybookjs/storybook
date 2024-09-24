import type { Plugin } from 'vite';

export async function templateCompilation() {
  return {
    name: 'storybook:vue-template-compilation',
    config: () => ({
      resolve: {
        alias: {
          vue: 'vue/dist/vue.esm-bundler.js',
        },
      },
    }),
  } satisfies Plugin;
}
