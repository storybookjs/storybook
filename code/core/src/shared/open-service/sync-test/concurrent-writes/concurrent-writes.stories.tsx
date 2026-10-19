import React, { useState, useSyncExternalStore } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';

import { OPEN_SERVICE_DEMO_PARAM_KEY } from '../addon/constants.ts';
import { createDemoStore } from '../demo-store.ts';
import { concurrentWritesSyncService } from './preview.ts';

const store = createDemoStore<Record<string, string>>({});

function ConcurrentWritesDemo() {
  const slots = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [slot, setSlot] = useState('story-slot');
  const [value, setValue] = useState('from-story');

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 520, padding: 24 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Open service concurrent writes demo</h1>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        Each click of Write runs <code>setSlot</code> once and emits one sync entry. The manager
        panel has the same controls. Two writers can each own a slot key.
      </p>

      <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <span>Slot</span>
        <input
          aria-label="Concurrent writes story slot input"
          type="text"
          value={slot}
          onChange={(event) => setSlot(event.currentTarget.value)}
          style={{ font: 'inherit', padding: '6px 8px', width: '100%' }}
        />
      </label>
      <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <span>Value</span>
        <input
          aria-label="Concurrent writes story value input"
          type="text"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          style={{ font: 'inherit', padding: '6px 8px', width: '100%' }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          aria-label="Concurrent writes story write"
          onClick={() => {
            void concurrentWritesSyncService.commands.setSlot({ slot, value });
          }}
        >
          Write
        </button>
        <button
          type="button"
          aria-label="Concurrent writes story clear slots"
          onClick={() => {
            void concurrentWritesSyncService.commands.clearSlots();
          }}
        >
          Clear slots
        </button>
      </div>

      <section>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Raw slots</h2>
        <pre
          data-testid="concurrent-writes-raw-service-state-slots"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            margin: 0,
            padding: 12,
          }}
        >
          {JSON.stringify(slots)}
        </pre>
      </section>
    </main>
  );
}

/**
 * Exercises open-service writes to distinct keys from the manager panel and the preview story.
 */
const meta = {
  title: 'Open Service/Sync Test/Concurrent Writes',
  component: ConcurrentWritesDemo,
  parameters: {
    layout: 'centered',
    [OPEN_SERVICE_DEMO_PARAM_KEY]: { enabled: true },
  },
  beforeEach: () => {
    const initialSlots = concurrentWritesSyncService.queries.slots.get();
    store.set(initialSlots);
    const unsubscribe = concurrentWritesSyncService.queries.slots.subscribe(undefined, ({ data }) =>
      store.set(data ?? {})
    );
    return async () => {
      unsubscribe();
      store.set(initialSlots);
      await concurrentWritesSyncService.commands.clearSlots();
      for (const [slot, value] of Object.entries(initialSlots)) {
        await concurrentWritesSyncService.commands.setSlot({ slot, value });
      }
    };
  },
} satisfies Meta<typeof ConcurrentWritesDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConcurrentWritesSync: Story = {};

export const ConcurrentWritesPlayFunction: Story = {
  play: async ({ canvas }) => {
    const slotInput = await canvas.findByLabelText('Concurrent writes story slot input');
    const valueInput = await canvas.findByLabelText('Concurrent writes story value input');
    const write = await canvas.findByRole('button', { name: 'Concurrent writes story write' });
    const raw = await canvas.findByTestId('concurrent-writes-raw-service-state-slots');

    await fireEvent.input(slotInput, { target: { value: 'play-slot' } });
    await fireEvent.input(valueInput, { target: { value: 'play-value' } });
    await userEvent.click(write);

    await waitFor(() => {
      expect(JSON.parse(raw.textContent ?? '{}')).toMatchObject({
        'play-slot': 'play-value',
      });
    });
  },
};
