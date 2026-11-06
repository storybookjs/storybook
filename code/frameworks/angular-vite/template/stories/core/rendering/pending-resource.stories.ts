import { Component, resource } from '@angular/core';

import type { Meta, StoryObj } from '@storybook/angular-vite';

import { expect, within } from 'storybook/test';

// The loader never settles, so the application never becomes stable while this component lives.
@Component({
  selector: 'sb-pending-resource',
  template: `<p>{{ status() }}</p>`,
})
class PendingResourceComponent {
  readonly data = resource({ loader: () => new Promise<string>(() => {}) });
  readonly status = () => (this.data.isLoading() ? 'Loading forever' : 'Loaded');
}

const meta: Meta<PendingResourceComponent> = {
  component: PendingResourceComponent,
};

export default meta;

type Story = StoryObj<PendingResourceComponent>;

export const RendersWhileNeverStable: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading forever')).toBeInTheDocument();
  },
};
