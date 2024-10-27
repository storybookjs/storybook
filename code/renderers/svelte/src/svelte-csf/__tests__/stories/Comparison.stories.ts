import type { Meta, StoryObj } from '@storybook/svelte';

import Comparison from './Comparison.svelte';

/**
 * A quick overview on how to write a stories file using **Regular CSF** format.
 *
 * ```js
 * import Comparison from "./Comparison.svelte";
 *
 * const meta = {
 *   title: "Comparison/Regular CSF",
 *   component: Comparison,
 * };
 *
 * export const Default = {
 *   args: { csf: 'regular' }
 * };
 * ```
 */
const meta = {
  title: 'Comparison/Regular CSF',
  // FIXME: `@storybook/svelte`.Meta needs to start using `Component` instead of `ComponentType`/`SvelteComponent`
  // @ts-expect-error
  component: Comparison,
  argTypes: {
    // @ts-expect-error
    csf: { table: { disable: true } },
  },
  tags: ['autodocs', '!dev'],
} satisfies Meta<typeof Comparison>;

export default meta;

type Story = StoryObj<typeof Comparison>;

export const Default: Story = {
  // FIXME: `@storybook/svelte`.Meta needs to start using `Component` instead of `ComponentType`/`SvelteComponent`
  // @ts-expect-error
  args: { csf: 'regular' },
};
