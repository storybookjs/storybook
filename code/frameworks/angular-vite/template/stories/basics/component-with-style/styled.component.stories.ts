import type { Meta, StoryObj } from '@storybook/angular-vite';

import { StyledComponent } from './styled.component';

const meta: Meta = {
  // title: 'Basics / Component / With StyleUrls',
  component: StyledComponent,
};

export default meta;

type Story = StoryObj<StyledComponent>;

export const ComponentWithStyles: Story = {
  name: 'Component with styles',
};
