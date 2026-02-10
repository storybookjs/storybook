```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      build: {
        ...config.build,
        watch: {}, // Enable watch mode
      },
    };
  },
};
```
