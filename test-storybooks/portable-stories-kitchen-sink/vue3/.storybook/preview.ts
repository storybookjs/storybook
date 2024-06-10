import type { Preview } from '@storybook/vue3';

console.log('preview file is called!');

const preview: Preview = {
  // TODO: figure out decorators
  decorators: [
    () => ({ 
      template: `
        <div data-decorator>
          Global Decorator
          <br />
          <story />
        </div>
      `
    })
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
