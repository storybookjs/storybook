import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from '@storybook/test';
import { redirect } from 'next/navigation';

let state = 'Bug! Not invalidated';

export default {
  render() {
    return (
      <div>
        <div>{state}</div>
        <form
          action={() => {
            state = 'State is invalidated successfully.';
            redirect('/');
          }}
        >
          <button>Submit</button>
        </form>
      </div>
    );
  },
  parameters: {
    test: {
      // This is needed until Next will update to the React 19 beta: https://github.com/vercel/next.js/pull/65058
      // In the React 19 beta ErrorBoundary errors (such as redirect) are only logged, and not thrown.
      // We will also suspress console.error logs for re the console.error logs for redirect in the next framework.
      // Using the onCaughtError react root option:
      //   react: {
      //     rootOptions: {
      //       onCaughtError(error: unknown) {
      //         if (isNextRouterError(error)) return;
      //         console.error(error);
      //       },
      //     },
      // See: code/frameworks/nextjs/src/preview.tsx
      dangerouslyIgnoreUnhandledErrors: true,
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
      },
    },
  },
  tags: ['!test'],
} as Meta;

export const SingletonStateGetsInvalidatedAfterRedirecting: StoryObj = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
  },
};
