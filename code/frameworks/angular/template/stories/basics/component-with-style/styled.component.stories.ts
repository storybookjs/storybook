import { Meta, StoryObj } from '@storybook/angular';

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
