import { Component, Injectable, inject, provideAppInitializer } from '@angular/core';

import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig } from '@storybook/angular-vite';

import { expect, within } from 'storybook/test';

@Injectable({ providedIn: 'root' })
class LabelService {
  label = '';
}

@Component({
  selector: 'sb-app-initializer',
  template: `<p>{{ labelService.label }}</p>`,
})
class AppInitializerComponent {
  readonly labelService = inject(LabelService);
}

const meta: Meta<AppInitializerComponent> = {
  component: AppInitializerComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideAppInitializer(async () => {
          const labelService = inject(LabelService);
          await new Promise((resolve) => setTimeout(resolve, 50));
          labelService.label = 'Initialized before render';
        }),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<AppInitializerComponent>;

export const RendersAfterAsyncInitializer: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Initialized before render')).toBeInTheDocument();
  },
};
