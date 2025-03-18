import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import ProviderButtonComponent, { ApiService } from './test-component/provider-button';

class MockService {
  data: string = 'Mock Service';
}

const mockService = new MockService();

const meta: Meta<ProviderButtonComponent> = {
  component: ProviderButtonComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      providers: [{ provide: ApiService, useValue: mockService }],
    }),
  ],
};

export default meta;

type Story = StoryObj<ProviderButtonComponent>;

export const ProviderTest: Story = {
  args: {
    label: 'Test',
  },
};
