import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { expect, within } from 'storybook/test';

let mockedUser = 'unmocked';
const beforeLoadCalls: string[] = [];

function BeforeLoadViewer() {
  return <p data-testid="before-load-user">{beforeLoadCalls.join(',') || 'missing'}</p>;
}

const meta = {
  component: BeforeLoadViewer,
  parameters: {
    tanstack: {
      router: {
        route: {
          beforeLoad: () => {
            beforeLoadCalls.push(mockedUser);
          },
        },
      },
    },
  },
  beforeEach: () => {
    mockedUser = 'from-beforeEach';
    return () => {
      mockedUser = 'unmocked';
      beforeLoadCalls.length = 0;
    };
  },
} satisfies Meta<typeof BeforeLoadViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Route `beforeLoad` runs after the story's `beforeEach`, so it sees its mocks. */
export const BeforeLoadSeesBeforeEach: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('before-load-user')).toHaveTextContent('from-beforeEach');
    await expect(beforeLoadCalls.length).toBeGreaterThan(0);
    await expect(beforeLoadCalls.every((call) => call === 'from-beforeEach')).toBe(true);
  },
};

/** Route `beforeLoad` runs when `play` calls `mount`, so it sees mocks set up in `play`. */
export const BeforeLoadSeesPlayBeforeMount: Story = {
  play: async ({ mount }) => {
    mockedUser = 'from-play';
    const canvas = await mount();
    await expect(canvas.getByTestId('before-load-user')).toHaveTextContent('from-play');
    await expect(beforeLoadCalls.length).toBeGreaterThan(0);
    await expect(beforeLoadCalls.every((call) => call === 'from-play')).toBe(true);
  },
};

let routerStatusInBeforeEach = 'unset';

/** The story router exists in the story's `beforeEach`, before its initial load. */
export const RouterAvailableInBeforeEach: Story = {
  beforeEach: (context) => {
    const router = (context as any).tanstackRouter;
    routerStatusInBeforeEach = router ? router.state.status : 'missing';
  },
  play: async () => {
    await expect(routerStatusInBeforeEach).toBe('idle');
  },
};
