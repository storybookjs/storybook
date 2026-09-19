import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { useRouter } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

const InjectedContext = React.createContext('missing-provider');

function RouterContextViewer() {
  const router = useRouter();
  const injected = (router.options.context as { injected?: string } | undefined)?.injected;
  return <p data-testid="injected-router-context">{injected ?? 'missing-context'}</p>;
}

const meta = {
  component: RouterContextViewer,
  decorators: [
    (Story) => (
      <InjectedContext.Provider value="from-react-hook">
        <Story />
      </InjectedContext.Provider>
    ),
  ],
  parameters: {
    tanstack: {
      router: {
        useRouterContext: () => ({ injected: React.useContext(InjectedContext) }),
      },
    },
  },
} satisfies Meta<typeof RouterContextViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hook-derived values read from a decorator's React provider must reach the story's router. */
export const HookValuesReachRouter: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('injected-router-context')).toHaveTextContent(
      'from-react-hook'
    );
  },
};
