import type { Preview } from '@storybook/react-vite';
import { getDecoratorString } from './get-decorator-string';

console.log('preview file is called!');

const preview: Preview = {
  decorators: [
    (StoryFn) => (
      <div data-testid="global-decorator">
        <div data-testid="decorator-string">{getDecoratorString()}</div>
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
