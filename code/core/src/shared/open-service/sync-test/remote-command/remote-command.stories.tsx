import React, { useSyncExternalStore } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor } from 'storybook/test';

import { OPEN_SERVICE_DEMO_PARAM_KEY } from '../addon/constants.ts';
import { createDemoStore } from '../demo-store.ts';
import { remoteCommandSyncService } from './preview.ts';

const store = createDemoStore('');

function RemoteCommandDemo() {
  const value = useSyncExternalStore(store.subscribe, store.get, store.get);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 520, padding: 24 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Open service remote command sync demo</h1>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        This story shares one open-service value with the manager Open Service panel. Typing here or
        in the panel input invokes the server-only <code>setValue</code> command remotely, then
        syncs the updated state back to manager and preview.
      </p>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        In a built Storybook this variant intentionally does nothing: it depends on the dev server
        to run <code>setValue</code> and mutate the service state.
      </p>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        The play-function variant is skipped in Storybook Vitest because that runner does not
        provide the full manager/preview/server channel path. Run it in the Storybook UI
        interactions panel, or use the internal Playwright e2e, to exercise the remote command path.
      </p>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>Story input</span>
        <input
          aria-label="Remote command story sync input"
          type="text"
          value={value}
          placeholder="Type to sync with the manager panel"
          onChange={(event) => {
            void remoteCommandSyncService.commands.setValue({ value: event.currentTarget.value });
          }}
          style={{ font: 'inherit', padding: '6px 8px', width: '100%' }}
        />
      </label>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Raw service value</h2>
        <pre
          data-testid="remote-command-raw-service-state-value"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            margin: 0,
            padding: 12,
          }}
        >
          {JSON.stringify(value)}
        </pre>
      </section>
    </main>
  );
}

/**
 * Exercises open-service remote command execution: manager and preview call a command implemented
 * only by the dev server, then observe synchronized state. This variant does not update state in a
 * built Storybook because there is no dev server peer to run the command.
 */
const meta = {
  title: 'Open Service/Sync Test/Remote Command',
  component: RemoteCommandDemo,
  parameters: {
    chromatic: { disableSnapshot: true },
    layout: 'centered',
    [OPEN_SERVICE_DEMO_PARAM_KEY]: { enabled: true },
  },
  beforeEach: () => {
    const initialValue = remoteCommandSyncService.queries.getValue.get();
    store.set(initialValue);
    const unsubscribe = remoteCommandSyncService.queries.getValue.subscribe(undefined, ({ data }) =>
      store.set(data ?? '')
    );
    return async () => {
      unsubscribe();
      store.set(initialValue);
      await remoteCommandSyncService.commands.setValue({ value: initialValue }).catch(() => {});
    };
  },
} satisfies Meta<typeof RemoteCommandDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RemoteCommandSync: Story = {};

/**
 * Runs only in the real Storybook UI/e2e environment because it depends on the server handling the
 * remote command.
 */
export const RemoteCommandPlayFunction: Story = {
  tags: ['!vitest'],
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('Remote command story sync input');
    const raw = await canvas.findByTestId('remote-command-raw-service-state-value');
    const nextValue = 'play-function-sync-value';

    await userEvent.clear(input);

    await waitFor(() => {
      expect(raw).toHaveTextContent(JSON.stringify(''));
    });

    for (const character of nextValue) {
      await userEvent.type(input, character);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await waitFor(() => {
      expect(raw).toHaveTextContent(JSON.stringify(nextValue));
    });
  },
};
