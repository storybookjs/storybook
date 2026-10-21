import React from 'react';

import { addons, useChannel } from 'storybook/preview-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { isChromatic } from '../../../.storybook/isChromatic.ts';
import preview from '../../../.storybook/preview.tsx';
import { StoryContent } from './StoryContent.tsx';
import {
  HIGHLIGHT,
  HIGHLIGHT_MENU_CLICK,
  REMOVE_HIGHLIGHT,
  SCROLL_INTO_VIEW,
} from './constants.ts';
import { useHighlightMenu } from './manager.ts';

/**
 * The highlight menu is rendered by the manager, positioned over the preview iframe. Neither
 * Vitest nor Chromatic loads the manager, so boot the manager-side menu on the same (local)
 * channel to exercise the full preview → manager flow in a single document. Run it from a
 * decorator (not the play function) so the menu is listening before the highlights decorator emits
 * its `HIGHLIGHT` events, which populate the manager-side registry the menu renders from.
 */
const setupHighlightMenu = () => {
  const isVitest = (globalThis as { __vitest_browser__?: boolean }).__vitest_browser__;
  if (!isVitest && !isChromatic()) {
    return;
  }
  useHighlightMenu(addons.getChannel());
};

/** The menu is rendered in the manager document, except in Vitest and Chromatic where it is local. */
const getHighlightMenu = () => {
  const local = document.getElementById('storybook-highlights-menu');
  if (local) {
    return local;
  }
  try {
    return parent.document.getElementById('storybook-highlights-menu');
  } catch {
    return null;
  }
};

const highlight = (
  selectors: string[],
  options?: {
    id?: string;
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
      clickable?: boolean;
    }[];
  }
) => {
  const emit = useChannel({});
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
  decorators: [
    (storyFn) => {
      setupHighlightMenu();
      return storyFn();
    },
  ],
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
          id: 'menu-highlight',
          menu: [
            [
              {
                id: 'color-contrast',
                title: 'Insufficient color contrast',
                description: 'Elements must meet minimum color contrast ratio thresholds.',
                clickable: true,
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
                clickable: true,
              },
            ],
          ],
        },
      },
    ],
  },
  decorators: [
    (storyFn) => {
      setupHighlightMenu();
      return storyFn();
    },
  ],
  play: async ({ canvasElement }) => {
    const onMenuClick = fn();
    addons.getChannel().on(HIGHLIGHT_MENU_CLICK, onMenuClick);
    const clickAt = (element: Element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return userEvent.pointer({
        target: element,
        coords: {
          pageX: left + width / 2 + window.scrollX,
          pageY: top + height / 2 + window.scrollY,
        },
        keys: '[MouseLeft]',
      });
    };

    await new Promise((resolve) => setTimeout(resolve, 200));
    await clickAt(canvasElement.querySelector('#inner')!);

    const menu = await waitFor(() => {
      const element = getHighlightMenu()!;
      expect(element.querySelector('.element-list button')).not.toBeNull();
      return element;
    });

    // Chromatic does not load the manager, so the menu booted into the preview can open but its
    // clicks would also be handled by the preview's own click listener. Stop after opening the
    // menu so the snapshot captures it, and let Vitest run the interaction to completion instead.
    if (isChromatic()) {
      return;
    }

    await clickAt(menu.querySelector('.element-list button')!);

    const menuItem = await waitFor(() => within(menu).getByText('Insufficient color contrast'));
    await clickAt(menuItem);

    addons.getChannel().off(HIGHLIGHT_MENU_CLICK, onMenuClick);
    await expect(onMenuClick).toHaveBeenCalledWith(
      'menu-highlight',
      'color-contrast',
      expect.objectContaining({ selectors: ['div'] })
    );
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
