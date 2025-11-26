import JSDoc from './jsdoc.svelte';

/** @typedef {import('@storybook/svelte-vite').StoryObj} StoryObj */

/** @type {Meta<typeof JSDoc>} */
const meta = {
  component: JSDoc,
  tags: ['autodocs'],
  render: (args, { argTypes }) => ({
    Component: JSDoc,
    props: { ...args, argTypes },
  }),
};

export default meta;

export const Default = {};
