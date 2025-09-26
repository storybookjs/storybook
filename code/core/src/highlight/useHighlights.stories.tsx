import React from 'react';

import { useChannel } from 'storybook/preview-api';
import { fn, userEvent, within } from 'storybook/test';

import preview from '../../../.storybook/preview';
import { StoryContent } from './StoryContent';
import { HIGHLIGHT, REMOVE_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';

const highlight = (
  selectors: string[],
  options?: {
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
  const emit = useChannel({ 'my-click-event': fn().mockName('my-click-event') });
  const id = Math.random().toString(36).substring(2, 15);
  React.useEffect(() => {
    emit(HIGHLIGHT, {
      id,
      selectors,
      styles: {
        backgroundColor: `color-mix(in srgb, teal, transparent 80%)`,
        outline: `1px solid color-mix(in srgb, teal, transparent 30%)`,
      },
      hoverStyles: options?.menu ? { outlineWidth: '2px' } : {},
      focusStyles: {
        backgroundColor: 'transparent',
      },
      ...options,
    });
    return () => emit(REMOVE_HIGHLIGHT, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emit]);
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
    return <StoryContent dynamic={parameters.dynamic} withPopover={parameters.withPopover} />;
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
            backgroundColor: `color-mix(in srgb, hotpink, transparent 90%)`,
            outline: '3px solid hotpink',
            animation: 'highlight-pulse 3s linear infinite',
            transition: 'outline-offset 0.2s ease-in-out',
          },
          hoverStyles: {
            outlineOffset: '3px',
          },
          focusStyles: {
            backgroundColor: 'transparent',
          },
          keyframes: `@keyframes highlight-pulse {
            0% { outline-color: rgba(255, 105, 180, 1); }
            50% { outline-color: rgba(255, 105, 180, 0.2); }
            100% { outline-color: rgba(255, 105, 180, 1); }
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
    highlights: [{ selectors: ['div', 'input'], options: { menu: [] } }],
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
            [
              {
                id: 'color-contrast',
                title: 'Insufficient color contrast',
                description: 'Elements must meet minimum color contrast ratio thresholds.',
                clickEvent: 'my-click-event',
              },
            ],
            [
              {
                id: 'links-need-discernible-text',
                title: 'Links need discernible text',
                description: 'This is where a summary of the violation goes.',
              },
              {
                id: 'links-need-discernible-text-details',
                title: 'Important stuff',
                description: 'Click here to view more details.',
                iconLeft: 'info',
                iconRight: 'shareAlt',
                clickEvent: 'my-click-event',
              },
            ],
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

    await new Promise((resolve) => setTimeout(resolve, 200));
    const elementItem = document.querySelector('#storybook-highlights-menu .element-list button')!;
    await userEvent.pointer({
      target: elementItem,
      coords: { pageX: 470, pageY: 260 },
      keys: '[MouseLeft]',
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    const menuItem = document.querySelector('#storybook-highlights-menu .menu-list button')!;
    await userEvent.pointer({
      target: menuItem,
      coords: { pageX: 470, pageY: 310 },
      keys: '[MouseLeft]',
    });
  },
});

export const OnPopover = meta.story({
  parameters: {
    highlights: [{ selectors: ['[popover]'], options: { menu: [] } }],
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
