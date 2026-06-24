import React, { useSyncExternalStore } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, waitFor } from 'storybook/test';

import { OPEN_SERVICE_DEMO_PARAM_KEY } from '../addon/constants.ts';
import { createDemoStore } from '../demo-store.ts';
import { localCommandSyncService } from './preview.ts';

const store = createDemoStore('');

function LocalCommandDemo() {
  // Safe to use React 18 API because this is only loaded in our own UI, not in React sandboxes.
  const value = useSyncExternalStore(store.subscribe, store.get, store.get);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 520, padding: 24 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Open service local command sync demo</h1>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        This story shares one open-service value with the manager Open Service panel. Typing here or
        in the panel input runs <code>setValue</code> locally in that runtime, then syncs the
        updated state to the other peers.
      </p>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        Unlike the remote-command sibling, this story can run in Storybook Vitest because the
        command handler is part of the shared definition.
      </p>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>Story input</span>
        <input
          aria-label="Local command story sync input"
          type="text"
          value={value}
          placeholder="Type to sync with the manager panel"
          onChange={(event) => {
            void localCommandSyncService.commands.setValue({ value: event.currentTarget.value });
          }}
          style={{ font: 'inherit', padding: '6px 8px', width: '100%' }}
        />
      </label>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Raw service value</h2>
        <pre
          data-testid="local-command-raw-service-state-value"
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
 * Exercises open-service local command execution: manager and preview call a command implemented in
 * the shared definition, then observe synchronized state.
 */
const meta = {
  title: 'Open Service/Sync Test/Local Command',
  component: LocalCommandDemo,
  parameters: {
    layout: 'centered',
    [OPEN_SERVICE_DEMO_PARAM_KEY]: { enabled: true },
  },
  beforeEach: () => {
    const initialValue = localCommandSyncService.queries.getValue();
    store.set(initialValue);
    const unsubscribe = localCommandSyncService.queries.getValue.subscribe(undefined, store.set);
    return async () => {
      unsubscribe();
      store.set(initialValue);
      await localCommandSyncService.commands.setValue({ value: initialValue });
    };
  },
} satisfies Meta<typeof LocalCommandDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LocalCommandSync: Story = {};

export const LocalCommandPlayFunction: Story = {
  play: async ({ canvas }) => {
    const input = await canvas.findByLabelText('Local command story sync input');
    const raw = await canvas.findByTestId('local-command-raw-service-state-value');
    const nextValue = 'local-command-sync-value';

    await fireEvent.input(input, { target: { value: '' } });

    await waitFor(() => {
      expect(raw).toHaveTextContent(JSON.stringify(''));
    });

    await fireEvent.input(input, { target: { value: nextValue } });

    await waitFor(() => {
      expect(raw).toHaveTextContent(JSON.stringify(nextValue));
    });
  },
};
