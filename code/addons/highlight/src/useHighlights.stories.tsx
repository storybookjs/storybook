import React, { useEffect, useState } from 'react';

import { mockChannel } from 'storybook/internal/preview-api';

import { fn, userEvent } from 'storybook/test';

import preview from '../../../.storybook/preview';
import { HIGHLIGHT, RESET_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';
import { useHighlights } from './useHighlights';

const Content = ({ dynamic }: { dynamic: boolean }) => {
  const [extra, setExtra] = useState(false);
  useEffect(() => {
    if (!dynamic) {
      return;
    }
    const interval = setInterval(() => setExtra((v) => !v), 1200);
    return () => clearInterval(interval);
  }, [dynamic]);
  return (
    <main style={{ minHeight: 1200 }}>
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
        id="overflow"
        style={{
          position: 'absolute',
          top: 100,
          left: 350,
          width: 200,
          height: 150,
          border: '1px solid black',
          overflow: 'auto',
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
      <div
        id="footer"
        style={{
          position: 'absolute',
          top: 1000,
          left: 10,
          right: 10,
          height: 190,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
    </main>
  );
};

const channel = mockChannel();
channel.on('click', fn().mockName('click'));

const meta = preview.meta({
  render: () => {
    useEffect(() => useHighlights({ channel, menuId: 'menu', rootId: 'root' }), []);
    return <></>;
  },
  args: {
    channel,
  },
  parameters: {
    layout: 'fullscreen',
    highlight: {
      disable: true,
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <>
        <Content dynamic={parameters.dynamic} />
        <Story />,
      </>
    ),
  ],
});

const highlight = (
  selectors: string[],
  options?: {
    styles?: Record<string, string>;
    selectedStyles?: Record<string, string>;
    keyframes?: string;
    selectable?: boolean;
    menuListItems?: {
      id: string;
      title: string;
      description?: string;
      right?: string;
      href?: string;
      clickEvent?: string;
    }[];
  }
) =>
  channel.emit(HIGHLIGHT, {
    selectors,
    styles: {
      background: 'rgba(0, 137, 80, 0.2)',
      border: '1px solid teal',
    },
    selectedStyles: {
      background: 'transparent',
      border: '2px solid black',
    },
    selectable: options?.selectable ?? !!options?.menuListItems?.length,
    ...options,
  });

export const Default = meta.story({
  play: async () => {
    highlight(['div']);
  },
});

export const Multiple = meta.story({
  play: async () => {
    highlight(['main > div']);
    highlight(['div > div'], {
      styles: {
        border: '3px solid hotpink',
      },
    });
  },
});

export const Dynamic = meta.story({
  parameters: {
    dynamic: true,
  },
  play: async ({ canvasElement }) => {
    highlight(['div']);

    const scaling = canvasElement.querySelector('#scaling') as HTMLElement;
    const moving = canvasElement.querySelector('#moving') as HTMLElement;
    setInterval(() => {
      scaling.style.height = `${parseInt(scaling.style.height) + 5}px`;
      moving.style.left = `${parseInt(moving.style.left) + 5}px`;
    }, 1000);
  },
});

export const Styles = meta.story({
  play: async () => {
    highlight(['div'], {
      styles: {
        outline: '3px dashed hotpink',
        animation: 'pulse 3s linear infinite',
        transition: 'outline-offset 0.2s ease-in-out',
      },
      selectedStyles: {
        outlineOffset: '3px',
      },
      keyframes: `@keyframes pulse {
        0% { outline: 3px dashed rgba(255, 105, 180, 1); }
        50% { outline: 3px dashed rgba(255, 105, 180, 0.2); }
        100% { outline: 3px dashed rgba(255, 105, 180, 1); }
      }`,
    });
  },
});

export const ScrollIntoView = meta.story({
  play: async () => {
    channel.emit(SCROLL_INTO_VIEW, '#footer');
  },
});

export const Popover = meta.story({
  play: async () => {
    highlight(['div'], {
      selectable: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    await userEvent.pointer({
      target: document.body,
      coords: { pageX: 470, pageY: 240 },
      keys: '[MouseLeft]',
    });
  },
});

export const Menu = meta.story({
  parameters: {
    // dynamic: true,
  },
  play: async () => {
    highlight(['div'], {
      menuListItems: [
        {
          id: '1',
          title: 'Insufficient color contrast',
          description: 'Elements must meet minimum color contrast ratio thresholds.',
          clickEvent: 'click',
        },
        {
          id: '2',
          title: 'Links need discernible text',
          description: 'This is where a summary of the violation goes.',
          clickEvent: 'click',
        },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    await userEvent.pointer({
      target: document.body,
      coords: { pageX: 470, pageY: 240 },
      keys: '[MouseLeft]',
    });
  },
});

const Toggler = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    let timeout = setTimeout(() => highlight(['div']), 1500);
    const interval = setInterval(() => {
      channel.emit(RESET_HIGHLIGHT);
      timeout = setTimeout(() => highlight(['div']), 1500);
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);
  return children;
};

export const Toggling = meta.story({
  decorators: [
    (Story) => (
      <Toggler>
        <Story />
      </Toggler>
    ),
  ],
});
