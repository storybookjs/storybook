// TODO: this is a stupid map to maintain and it's not complete, but we can't easily get the current renderer name
export const frameworkToRendererMap: Record<string, string> = {
  '@storybook/react-vite': '@storybook/react',
  '@storybook/react-webpack5': '@storybook/react',
  '@storybook/nextjs': '@storybook/react',
  '@storybook/nextjs-vite': '@storybook/react',
  '@storybook/react-native-web-vite': '@storybook/react',

  '@storybook/vue3-vite': '@storybook/vue3',
  '@nuxtjs/storybook': '@storybook/vue3',

  '@storybook/angular': '@storybook/angular',
  '@storybook/angular-vite': '@storybook/angular',

  '@storybook/svelte-vite': '@storybook/svelte',
  '@storybook/sveltekit': '@storybook/svelte',

  '@storybook/preact-vite': '@storybook/preact',

  '@storybook/web-components-vite': '@storybook/web-components',

  '@storybook/html-vite': '@storybook/html',
};
