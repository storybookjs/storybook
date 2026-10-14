import { setup } from '@storybook/vue3';

// @ts-expect-error The repository uses Vue 3.5, which does not export it. This sandbox installs Vue 3.6.
import { vaporInteropPlugin } from 'vue';

setup((app) => {
  app.use(vaporInteropPlugin);
});

export default {};
