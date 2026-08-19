import type { Meta, StoryObj } from '@storybook/angular-vite';

import { DynamicSnippetsComponent } from './dynamic-snippets.component';

/**
 * Fixture for `code/e2e-sandbox/dynamic-snippets.spec.ts`.
 *
 * Deliberately minimal: one string input the e2e can type into, and the Code panel switched on so
 * the spec can read the snippet. Anything else here - a second input, a spread, a `render` - would
 * change which snippet path the story takes and make a failure ambiguous.
 */
const meta: Meta<DynamicSnippetsComponent> = {
  component: DynamicSnippetsComponent,
  // The docs half of the spec reads the Source block on this component's autodocs page.
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
    // `sourceState: 'shown'` so the docs half of the spec reads the Source block directly instead of
    // driving a disclosure button, which is UI the test does not exist to cover.
    docs: { codePanel: true, canvas: { sourceState: 'shown' } },
  },
};

export default meta;

type Story = StoryObj<DynamicSnippetsComponent>;

export const Default: Story = {
  args: { label: 'declaredLabel' },
};
