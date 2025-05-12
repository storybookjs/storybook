import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import NotStandaloneComponent, { ApiModule } from "./not-standalone-component/not-standalone-component";


const meta: Meta<NotStandaloneComponent> = {
  component: NotStandaloneComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [ApiModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<NotStandaloneComponent>;

export const ProviderOnNotStandaloneWithoutArgs: Story = {};
