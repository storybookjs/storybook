import React from 'react';

import { useChannel } from 'storybook/internal/preview-api';

import { fn, userEvent, within } from 'storybook/test';

import preview from '../../../.storybook/preview';
import { HIGHLIGHT, REMOVE_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';

const highlight = (
  selectors: string[],
  options?: {
    selectable?: boolean;
    styles?: Record<string, string>;
    hoverStyles?: Record<string, string>;
    focusStyles?: Record<string, string>;
    keyframes?: string;
    menu?: {
      id: string;
      title: string;
      description?: string;
      right?: string;
      href?: string;
      clickEvent?: string;
    }[];
  }
) => {
  const emit = useChannel({ click: fn().mockName('click') });
  const id = Math.random().toString(36).substring(2, 15);
  React.useEffect(() => {
    emit(HIGHLIGHT, {
      id,
      selectors,
      selectable: options?.selectable ?? !!options?.menu?.length,
      styles: {
        backgroundColor: `color-mix(in srgb, teal, transparent 80%)`,
        outline: `1px solid color-mix(in srgb, teal, transparent 30%)`,
      },
      hoverStyles: options?.selectable || options?.menu?.length ? { outlineWidth: '2px' } : {},
      focusStyles: {
        backgroundColor: 'transparent',
      },
      ...options,
    });
    return () => emit(REMOVE_HIGHLIGHT, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit]);
};

const Content = ({ dynamic, withPopover }: { dynamic: boolean; withPopover: boolean }) => {
  const [extra, setExtra] = React.useState(false);
  React.useEffect(() => {
    if (!dynamic) {
      return;
    }
    const interval = setInterval(() => setExtra((v) => !v), 1200);
    return () => clearInterval(interval);
  }, [dynamic]);

  return (
    <main style={{ minHeight: 1200, minWidth: 1200 }}>
      {withPopover && (
        <>
          {/* @ts-expect-error popover is not yet supported by React */}
          <button popovertarget="my-popover">Open Popover 1</button>
          {/* @ts-expect-error popover is not yet supported by React */}
          <div popover="manual" id="my-popover" style={{ padding: 20 }}>
            Greetings, one and all!
          </div>
        </>
      )}
      <input id="input" type="text" style={{ margin: 20 }} defaultValue="input" />
      <div id="zeroheight" />
      <div id="zerowidth" style={{ width: 0, margin: 20 }} />
      <div
        id="sticky"
        style={{
          position: 'sticky',
          marginTop: 150,
          top: 0,
          left: 0,
          width: '100%',
          height: 50,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="fixed"
        style={{
          position: 'fixed',
          top: 300,
          left: 50,
          right: 50,
          height: 150,
          border: '1px solid black',
          borderRadius: 10,
        }}
      />
      <div
        id="moving"
        style={{
          position: 'absolute',
          top: 100,
          left: 150,
          width: 150,
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
            left: '-1px',
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
            top: 325,
            left: 75,
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

const meta = preview.meta({
  title: 'Highlight',
  decorators: [
    (storyFn, { parameters }) => {
      // @ts-expect-error Parameters are not inferred
      parameters.highlights.forEach(({ selectors, options }) => highlight(selectors, options));
      return storyFn();
    },
  ],
  render: (args, { parameters }) => {
    return <Content dynamic={parameters.dynamic} withPopover={parameters.withPopover} />;
  },
  parameters: {
    layout: 'fullscreen',
    highlights: [],
  },
});

export const Default = meta.story({
  parameters: {
    highlights: [{ selectors: ['div', 'input'] }],
  },
});

export const Multiple = meta.story({
  parameters: {
    highlights: [
      { selectors: ['main > div', 'input'] },
      { selectors: ['div > div'], options: { styles: { border: '3px solid hotpink' } } },
    ],
  },
});

export const Dynamic = meta.story({
  parameters: {
    dynamic: true,
    highlights: [{ selectors: ['div', 'input'] }],
  },
  play: async ({ canvasElement }) => {
    const scaling = canvasElement.querySelector('#scaling') as HTMLElement;
    const moving = canvasElement.querySelector('#moving') as HTMLElement;

    const interval = setInterval(() => {
      scaling.style.height = `${parseInt(scaling.style.height) + 5}px`;
      moving.style.left = `${parseInt(moving.style.left) + 5}px`;
    }, 1000);
    setTimeout(() => clearInterval(interval), 60000);
  },
});

export const Styles = meta.story({
  parameters: {
    highlights: [
      {
        selectors: ['div', 'input'],
        options: {
          styles: {
            outline: '3px dashed hotpink',
            animation: 'pulse 3s linear infinite',
            transition: 'outline-offset 0.2s ease-in-out',
          },
          focusStyles: {
            outlineOffset: '3px',
          },
          keyframes: `@keyframes pulse {
            0% { outline: 3px dashed rgba(255, 105, 180, 1); }
            50% { outline: 3px dashed rgba(255, 105, 180, 0.2); }
            100% { outline: 3px dashed rgba(255, 105, 180, 1); }
          }`,
        },
      },
    ],
  },
});

export const ScrollIntoView = meta.story({
  decorators: [
    (storyFn) => {
      const emit = useChannel({});
      React.useEffect(() => emit(SCROLL_INTO_VIEW, '#footer'), [emit]);
      return storyFn();
    },
  ],
});

export const Selectable = meta.story({
  parameters: {
    highlights: [{ selectors: ['div', 'input'], options: { selectable: true } }],
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await userEvent.pointer({
      coords: { pageX: 470, pageY: 240 },
      keys: '[MouseLeft]',
    });
  },
});

export const Menu = meta.story({
  parameters: {
    highlights: [
      {
        selectors: ['div', 'input'],
        options: {
          menu: [
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
        },
      },
    ],
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await userEvent.pointer({
      coords: { pageX: 470, pageY: 240 },
      keys: '[MouseLeft]',
    });
  },
});

export const OnPopover = meta.story({
  parameters: {
    highlights: [{ selectors: ['[popover]'], options: { selectable: true } }],
    withPopover: true,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByText('Open Popover 1');
    await userEvent.click(button);

    await new Promise((resolve) => setTimeout(resolve, 200));
    await userEvent.pointer({
      coords: { pageX: window.innerWidth / 2, pageY: window.innerHeight / 2 },
      keys: '[MouseLeft]',
    });
  },
});

export const LayoutCentered = meta.story({
  parameters: {
    highlights: [{ selectors: ['div'] }],
    layout: 'centered',
  },
  render: () => <div style={{ padding: 10 }}>Content</div>,
});
