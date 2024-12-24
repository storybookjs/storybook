```js filename=".storybook/main.js" renderer="react-native-web" language="js"
export default {
  addons: [
    '@storybook/addon-react-native-web', // 👈 Remove the addon
  ],
  // Replace @storybook/react-webpack5 with the Vite framework
  framework: '@storybook/react-native-web-vite',
};
```

```ts filename=".storybook/main.ts" renderer="react-native-web" language="ts"
import { StorybookConfig } from '@storybook/react-native-web-vite';

const config: StorybookConfig = {
  addons: [
    '@storybook/addon-react-native-web', // 👈 Remove the addon
  ],
  // Replace @storybook/react-webpack5 with the Vite framework
  framework: '@storybook/react-native-web-vite',
};

export default config;
```
