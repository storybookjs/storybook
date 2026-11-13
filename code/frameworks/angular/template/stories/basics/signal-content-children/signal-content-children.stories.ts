import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { expect } from 'storybook/test';

import { ContentChildComponent, ContentParentComponent } from './signal-content-children';

const meta = {
  component: ContentParentComponent,
  decorators: [moduleMetadata({ declarations: [ContentChildComponent] })],
} satisfies Meta<ContentParentComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PreservesSignalQuery: Story = {
  render: () => ({
    props: {
      options: [],
      label: 'Ordinary props still update',
    },
    template: `
      <storybook-content-parent>
        <storybook-content-child />
        <storybook-content-child />
      </storybook-content-parent>
    `,
  }),
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('query-result')).toHaveTextContent('2 projected children');
    await expect(canvas.getByTestId('label')).toHaveTextContent('Ordinary props still update');
  },
};
