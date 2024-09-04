import type { Preview } from '@storybook/svelte';
import GlobalDecorator from './GlobalDecorator.svelte'

console.log('preview file is called!');

const preview: Preview = {
  decorators: [
    () => (
      {
        Component: GlobalDecorator,
      }
    ),
  ],
  globalTypes: {
    locale: {
      description: 'Locale for components',
      defaultValue: 'en',
      toolbar: {
        title: 'Locale',
        icon: 'circlehollow',
        items: ['es', 'en'],
      },
    },
  },
};

export default preview;
