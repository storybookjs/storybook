import React, { useEffect, useState } from 'react';

import { userEvent } from 'storybook/test';

import preview from '../../../.storybook/preview';
import { Highlights } from './Highlights';

const Content = ({ dynamic }: { dynamic: boolean }) => {
  const [extra, setExtra] = useState(false);
  useEffect(() => {
    if (!dynamic) {
      return;
    }
    const interval = setInterval(() => setExtra((v) => !v), 2000);
    return () => clearInterval(interval);
  }, [dynamic]);
  return (
    <main style={{ minHeight: 800 }}>
      <div
        id="moving"
        style={{
          position: 'absolute',
          top: 100,
          left: 100,
          width: 200,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="scaling"
        style={{
          position: 'absolute',
          top: 50,
          left: '50%',
          width: 200,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      >
        <div
          id="inner"
          style={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: 120,
            height: '50%',
            border: '1px solid black',
            borderRadius: 10,
          }}
        />
      </div>
      <div
        id="scrolling"
        style={{
          position: 'absolute',
          top: 100,
          left: 350,
          width: 200,
          height: 150,
          border: '1px solid black',
          overflow: 'scroll',
        }}
      >
        <div
          id="child"
          style={{
            margin: 30,
            width: 120,
            height: 200,
            backgroundColor: 'yellow',
          }}
        />
      </div>
      {extra && (
        <div
          id="extra"
          style={{
            position: 'absolute',
            top: 300,
            left: 50,
            width: 300,
            height: 100,
            border: '1px solid black',
            borderRadius: 10,
          }}
        />
      )}
    </main>
  );
};

const meta = preview.meta({
  component: Highlights,
  decorators: [
    (Story, { args }) => (
      <>
        <Content dynamic={args.dynamic} />
        <Story />
      </>
    ),
  ],
});

export const Default = meta.story({
  args: {
    selectors: ['div'],
  },
});

export const Resizing = meta.story({
  args: {
    selectors: ['div'],
  },
  play: async ({ canvasElement }) => {
    const scaling = canvasElement.querySelector('#scaling') as HTMLElement;
    const moving = canvasElement.querySelector('#moving') as HTMLElement;
    setInterval(() => {
      scaling.style.height = `${parseInt(scaling.style.height) + 5}px`;
      moving.style.left = `${parseInt(moving.style.left) + 5}px`;
    }, 1000);
  },
});

export const Dynamic = meta.story({
  args: {
    selectors: ['div'],
    dynamic: true,
  },
});

export const Popover = meta.story({
  args: {
    selectors: ['div'],
  },
  play: async () => {
    await userEvent.pointer({
      target: document.getElementById('addon-highlight-container')!,
      coords: { clientX: 700, clientY: 130 },
      keys: '[MouseLeft]',
    });
  },
});
