import React, { useSyncExternalStore } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor } from 'storybook/test';

import { OPEN_SERVICE_DEMO_PARAM_KEY } from '../addon/constants.ts';
import { staticLoadSyncService } from './preview.ts';

type StaticLoadSnapshot = {
  alpha: string | undefined;
  beta: string | undefined;
  unbackedStatus: string;
};

let currentValue: StaticLoadSnapshot = {
  alpha: undefined,
  beta: undefined,
  unbackedStatus: 'pending',
};
const listeners = new Set<() => void>();

function setCurrentValue(value: StaticLoadSnapshot) {
  currentValue = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToCurrentValue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCurrentValue() {
  return currentValue;
}

function StaticLoadDemo() {
  const value = useSyncExternalStore(subscribeToCurrentValue, getCurrentValue, getCurrentValue);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 520, padding: 24 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Open service static load demo</h1>
      <p style={{ lineHeight: 1.5, margin: '0 0 16px' }}>
        This story shares static-load query results with the manager Open Service panel. In a
        production build, <code>getEntry</code> loads prebuilt JSON snapshots;{' '}
        <code>getUnbacked</code> has no static file and exercises the no-ack remote-command path.
      </p>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Entry alpha</h2>
        <pre
          data-testid="static-load-story-entry-alpha-value"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            margin: 0,
            padding: 12,
          }}
        >
          {JSON.stringify(value.alpha ?? null)}
        </pre>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Entry beta</h2>
        <pre
          data-testid="static-load-story-entry-beta-value"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            margin: 0,
            padding: 12,
          }}
        >
          {JSON.stringify(value.beta ?? null)}
        </pre>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Unbacked load</h2>
        <pre
          data-testid="static-load-story-unbacked-status"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: 4,
            margin: 0,
            padding: 12,
          }}
        >
          {value.unbackedStatus}
        </pre>
      </section>
    </main>
  );
}

const meta = {
  title: 'Open Service/Sync Test/Static Load',
  component: StaticLoadDemo,
  parameters: {
    chromatic: { disableSnapshot: true },
    layout: 'centered',
    [OPEN_SERVICE_DEMO_PARAM_KEY]: { enabled: true },
  },
  beforeEach: () => {
    let active = true;
    const initialValue: StaticLoadSnapshot = {
      alpha: staticLoadSyncService.queries.getEntry({ id: 'alpha' }),
      beta: staticLoadSyncService.queries.getEntry({ id: 'beta' }),
      unbackedStatus: 'pending',
    };
    setCurrentValue(initialValue);

    const unsubscribeAlpha = staticLoadSyncService.queries.getEntry.subscribe(
      { id: 'alpha' },
      (alpha) => {
        if (active) {
          setCurrentValue({ ...currentValue, alpha });
        }
      }
    );
    const unsubscribeBeta = staticLoadSyncService.queries.getEntry.subscribe(
      { id: 'beta' },
      (beta) => {
        if (active) {
          setCurrentValue({ ...currentValue, beta });
        }
      }
    );
    const unsubscribeUnbacked = staticLoadSyncService.queries.getUnbacked.subscribe((unbacked) => {
      if (active && unbacked !== null) {
        setCurrentValue({ ...currentValue, unbackedStatus: JSON.stringify(unbacked) });
      }
    });

    void staticLoadSyncService.queries.getUnbacked
      .loaded()
      .then((unbacked) => {
        if (active) {
          setCurrentValue({ ...currentValue, unbackedStatus: JSON.stringify(unbacked) });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCurrentValue({
            ...currentValue,
            unbackedStatus: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      active = false;
      unsubscribeAlpha();
      unsubscribeBeta();
      unsubscribeUnbacked();
      setCurrentValue(initialValue);
    };
  },
} satisfies Meta<typeof StaticLoadDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StaticLoadSync: Story = {
  tags: ['!vitest'],
  play: async ({ canvas }) => {
    const alpha = await canvas.findByTestId('static-load-story-entry-alpha-value');
    const beta = await canvas.findByTestId('static-load-story-entry-beta-value');
    const unbacked = await canvas.findByTestId('static-load-story-unbacked-status');

    await waitFor(() => {
      expect(alpha).not.toHaveTextContent(JSON.stringify(null));
    });
    await waitFor(() => {
      expect(beta).not.toHaveTextContent(JSON.stringify(null));
    });

    if (globalThis.CONFIG_TYPE === 'PRODUCTION') {
      await waitFor(() => {
        expect(unbacked).toHaveTextContent('No runtime acknowledged remote command');
      });
    } else {
      await waitFor(() => {
        expect(unbacked).toHaveTextContent(JSON.stringify('static-load:unbacked'));
      });
    }
  },
};
