import type { Meta, StoryObj } from '@storybook/angular-vite';

import { BrowserTargetBannerComponent } from './banner.component';

const meta: Meta = {
  // The banner's styling comes from the app's `build` (browser) target: its styles array and
  // stylePreprocessorOptions.includePaths reach the Storybook build through the browserTarget
  // merge. Losing either one shows up here as an unstyled banner (Chromatic diff) or as a Sass
  // resolution failure at build time.
  component: BrowserTargetBannerComponent,
};

export default meta;

type Story = StoryObj<BrowserTargetBannerComponent>;

export const BrowserTargetStyles: Story = {
  name: 'Browser target styles',
};
