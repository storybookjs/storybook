import JSDoc from './jsdoc.svelte';

/** @typedef {import('@storybook/svelte-vite').StoryObj} StoryObj */

/** @type {Meta<typeof JSDoc>} */
const meta = {
  component: JSDoc,
  tags: ['autodocs'],
  // These stories exist for the docgen sandbox baselines; the canvas shows no docgen output.
  parameters: { chromatic: { disableSnapshot: true } },
};

export default meta;

export const Default = {};
