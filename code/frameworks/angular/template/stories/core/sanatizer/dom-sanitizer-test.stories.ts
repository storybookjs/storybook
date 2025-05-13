import { Meta, StoryObj } from '@storybook/angular';
import SanitizerTestComponent from './test-component/sanitizer-test-component';

const meta: Meta<SanitizerTestComponent> = {
  component: SanitizerTestComponent,
  tags: ['autodocs'],
  parameters: {
    useTestBedRenderer: true,
  },
};

export default meta;

type Story = StoryObj<SanitizerTestComponent>;

export const TestSanitizer: Story = {
  args: {
    caption: "Here's my caption",
  },
};
