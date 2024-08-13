import BorderDecoratorBlue from './views/BorderDecoratorBlue.svelte';
import BorderDecoratorProps from './views/BorderDecoratorProps.svelte';
import BorderDecoratorRed from './views/BorderDecoratorRed.svelte';
import ButtonView from './views/ButtonJavaScript.svelte';

export default {
  component: ButtonView,
  decorators: [() => BorderDecoratorRed],
  args: {
    primary: true,
  },
  tags: ['autodocs'],
};

export const WithDefaultRedBorder = {};
export const WithBareBlueBorder = {
  decorators: [() => BorderDecoratorBlue],
};
export const WithPreparedBlueBorder = {
  decorators: [
    () => ({
      Component: BorderDecoratorBlue,
    }),
  ],
};
export const WithPropsBasedBorder = {
  decorators: [
    () => ({
      Component: BorderDecoratorProps,
      props: { color: 'green' },
    }),
  ],
};
export const WithArgsBasedBorderUnset = {
  argTypes: {
    color: { control: 'color' },
  },
  decorators: [(_, { args }) => ({ Component: BorderDecoratorProps, props: args })],
};
export const WithArgsBasedBorder = {
  ...WithArgsBasedBorderUnset,
  args: { color: 'lightblue' },
};
