import React, { useEffect, useState } from 'react';

import { userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';

const FreezeHarness = () => {
  const [clickCount, setClickCount] = useState(0);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickCount((value) => value + 1);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 12 }}>
      <h2>Freeze behavior playground</h2>
      <p data-testid="freeze-click-count">Clicks: {clickCount}</p>
      <p data-testid="freeze-tick-count">Ticks: {tickCount}</p>
      <button type="button" onClick={() => setClickCount((value) => value + 1)}>
        Increment
      </button>
      <div
        data-testid="freeze-spinner"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '4px solid #ddd',
          borderTopColor: '#1ea7fd',
          animation: 'freeze-spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes freeze-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const meta = preview.meta({
  component: FreezeHarness,
  parameters: {
    chromatic: {
      disableSnapshot: true,
    },
  },
});

export const Interval = meta.story({});

export const ButtonClick = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Increment' }));
  },
});

export const DelayedCompletion = meta.story({
  play: async () =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 3000);
    }),
});
