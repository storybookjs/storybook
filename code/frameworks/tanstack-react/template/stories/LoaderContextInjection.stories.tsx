import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { expect, within } from 'storybook/test';

const loaderCalls: unknown[] = [];

function LoaderContextViewer() {
  return <p data-testid="loader-context">{String(loaderCalls[0] ?? 'missing')}</p>;
}

const meta = {
  component: LoaderContextViewer,
  parameters: {
    tanstack: {
      router: {
        context: ({ storyContext }) => {
          loaderCalls.length = 0;
          return { injected: storyContext.args.injected };
        },
        route: {
          loader: ({ context }: { context: unknown }) => {
            loaderCalls.push((context as any)?.injected ?? null);
          },
        },
      },
    },
  },
} satisfies Meta<typeof LoaderContextViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Factory router context is visible to the route loader before render. */
export const FactoryValuesReachLoader: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('loader-context')).toHaveTextContent('from-factory');
    await expect(loaderCalls).toEqual(['from-factory']);
  },
};
