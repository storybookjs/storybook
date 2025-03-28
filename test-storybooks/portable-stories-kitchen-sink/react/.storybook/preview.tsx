import type { Preview } from '@storybook/react';

console.log('preview file is called!');

const preview: Preview = {
  decorators: [
    (StoryFn) => (
      <div data-testid="global-decorator">
        Global Decorator
        <br />
        <StoryFn />
      </div>
    ),
  ],
  initialGlobals: {
    locale: 'en',
  },
  globalTypes: {
    locale: {
      description: 'Locale for components',
      toolbar: {
        title: 'Locale',
        icon: 'circlehollow',
        items: ['es', 'en'],
      },
    },
  },
};

export default preview;
