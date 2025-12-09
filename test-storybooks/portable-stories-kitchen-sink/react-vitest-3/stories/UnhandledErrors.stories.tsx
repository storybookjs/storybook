import type { Meta, StoryObj } from '@storybook/react-vite';

async function unhandledRejection() {
  throwError('I THREW AN UNHANDLED REJECTION!');
}

function unhandledError() {
  throwError('I THREW AN UNHANDLED ERROR!');
}

function throwError(message: string) {
  throw new Error(message);
}
const meta = {
  title: 'Example/UnhandledErrors',
  args: {
    errorType: null,
    forceFailure: false,
  },
  component: ({ errorType, forceFailure }) => {
    if (forceFailure) {
      if (errorType === 'rejection') {
        setTimeout(unhandledRejection, 0);
      } else if (errorType === 'error') {
        setTimeout(unhandledError, 0);
      }
    }
    return 'Hello world';
  },
} as Meta<{ errorType: 'rejection' | 'error' | null; forceFailure?: boolean }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const UnhandledError: Story = {
  args: {
    errorType: 'error',
  },
};

export const UnhandledRejection: Story = {
  args: {
    errorType: 'rejection',
  },
};

export const Success: Story = {};
