import React, { useState } from 'react';

import { spyOn } from 'storybook/test';

import preview from '../../../../../.storybook/preview';
import { ManagerErrorBoundary } from './ManagerErrorBoundary';

// Component that throws an error immediately when rendered
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('This is a test error thrown by ThrowingComponent');
  }
  return <div>This component rendered successfully!</div>;
};

// Component that throws an error on interaction
const InteractiveThrowingComponent = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Error triggered by user interaction');
  }

  return <button onClick={() => setShouldThrow(true)}>Click to trigger error</button>;
};

// Component that throws an error with a long stack trace
const DeepErrorComponent = () => {
  const throwDeepError = () => {
    const level1 = () => {
      const level2 = () => {
        const level3 = () => {
          throw new Error('A deeply nested error with a long stack trace for testing purposes');
        };
        level3();
      };
      level2();
    };
    level1();
  };

  throwDeepError();
  return null;
};

const meta = preview.meta({
  title: 'ManagerErrorBoundary',
  component: ManagerErrorBoundary,
  parameters: {
    layout: 'fullscreen',
    test: {
      // Ignore unhandled errors in tests since we're testing error boundaries
      dangerouslyIgnoreUnhandledErrors: true,
    },
    chromatic: {
      // Pause at the error state for visual testing
      pauseAnimationAtEnd: true,
    },
  },
  decorators: [
    (Story) => {
      // Suppress console.error in stories to prevent noisy test output
      spyOn(console, 'error').mockImplementation(() => {});
      return <Story />;
    },
  ],
});

export default meta;

export const WithError = meta.story({
  render: () => (
    <ManagerErrorBoundary>
      <ThrowingComponent />
    </ManagerErrorBoundary>
  ),
});

export const WithDeepStackTrace = meta.story({
  render: () => (
    <ManagerErrorBoundary>
      <DeepErrorComponent />
    </ManagerErrorBoundary>
  ),
});

export const WithoutError = meta.story({
  render: () => (
    <ManagerErrorBoundary>
      <div style={{ padding: 40 }}>
        <h1>Everything is fine!</h1>
        <p>This content should render normally when there is no error.</p>
      </div>
    </ManagerErrorBoundary>
  ),
});

export const InteractiveError = meta.story({
  render: () => (
    <ManagerErrorBoundary>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Interactive Error Test</h2>
        <p>Click the button below to trigger an error and see the error boundary in action.</p>
        <InteractiveThrowingComponent />
      </div>
    </ManagerErrorBoundary>
  ),
});

export const CustomErrorMessage = meta.story({
  render: () => {
    const CustomError = () => {
      throw new Error(
        'Custom error: Unable to load addons configuration. Please check your manager.ts file.'
      );
    };

    return (
      <ManagerErrorBoundary>
        <CustomError />
      </ManagerErrorBoundary>
    );
  },
});
