import ButtonJavaScript from './views/ButtonJavaScript.svelte';

export default {
  component: ButtonJavaScript,
  args: {
    primary: true,
  },
  decorators: [
    (Story) => {
      console.log('decorator called');
      return Story();
    },
  ],
};

export const Default = {};
