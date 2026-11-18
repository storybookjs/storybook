import type { Meta, StoryObj } from '@storybook/angular-vite';

import RenderingBugComponent from './rendering-bug-component/rendering-bug-component';

const meta: Meta<RenderingBugComponent> = {
  component: RenderingBugComponent,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<RenderingBugComponent>;

export const RenderFuncOverridesAttributes: Story = {
  args: {
    label: 'Just a Test',
  },
  render: (args) => {
    const sample123 = (someArgument: string) => {
      console.log('Overridden', someArgument);
    };
    return {
      template: `
        <div>
          <span>Check Logs</span>
          <rendering-bug-component [label]="label"></rendering-bug-component>
        </div>`,
      props: { ...args, sample123 },
    };
  },
};
