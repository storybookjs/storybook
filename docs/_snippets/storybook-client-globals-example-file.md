```ts filename="vue/src/client/preview/globals.ts" renderer="common" language="ts"
import { global } from '@storybook/global';

const { window: globalWindow } = global;

globalWindow.STORYBOOK_ENV = 'vue';
```
