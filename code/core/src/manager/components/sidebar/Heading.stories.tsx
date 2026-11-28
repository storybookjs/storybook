import React from 'react';

import type { Decorator, Meta, StoryFn, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { expect, screen, within } from 'storybook/test';
import { type Theme, ThemeProvider, useTheme } from 'storybook/theming/emotion';

import { Heading } from './Heading.tsx';

type Story = StoryFn<typeof Heading>;

export default {
  component: Heading,
  title: 'Sidebar/Heading',
  excludeStories: /.*Data$/,
  parameters: { layout: 'fullscreen' },
  globals: { sb_theme: 'side-by-side' },
  decorators: [
    (storyFn) => <div style={{ padding: '0 20px', maxWidth: '230px' }}>{storyFn()}</div>,
  ],
} satisfies Meta<typeof Heading>;

const menuItems = [
  [
    { title: 'Menu Item 1', onClick: action('onActivateMenuItem'), id: '1' },
    { title: 'Menu Item 2', onClick: action('onActivateMenuItem'), id: '2' },
    { title: 'Menu Item 3', onClick: action('onActivateMenuItem'), id: '3' },
  ],
];

export const MenuHighlighted: Story = () => (
  <Heading menuHighlighted menu={menuItems} isLoading={false} />
);

export const standardData = { menu: menuItems };

export const Standard: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: undefined,
          url: undefined,
          image: undefined,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const StandardNoLink: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: undefined,
          url: null,
          image: undefined,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const LinkAndText: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My title',
          url: 'https://example.com',
          image: null,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const OnlyText: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My title',
          url: null,
          image: null,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const LongText: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My title is way to long to actually fit',
          url: null,
          image: null,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const CustomTitle: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: '<span style="color:red">My custom title</span>',
          url: null,
          image: null,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

// The `<img>` fails to load without a network request, so an unsanitized `onerror` would run.
const titleWithScript =
  '<span style="color:red">My custom title</span><img src="data:image/png;base64," onerror="window.__brandXss = true"><script>window.__brandXss = true</script>';

// The payload sets this flag if any of its scripts run.
const xssWindow = window as Window & { __brandXss?: boolean };

const withBrand = (brand: Partial<Theme['brand']>): Decorator =>
  function WithBrand(storyFn) {
    const theme = useTheme() as Theme;
    return (
      <ThemeProvider theme={{ ...theme, brand: { ...theme.brand, ...brand } }}>
        {storyFn()}
      </ThemeProvider>
    );
  };

const expectTitleSanitized = async (canvasElement: HTMLElement) => {
  const title = await within(canvasElement).findByText('My custom title');

  await expect(title).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  await expect(canvasElement.querySelector('script')).toBeNull();
  await expect(canvasElement.querySelector('[onerror]')).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await expect(xssWindow.__brandXss).toBeUndefined();
};

export const CustomTitleWithScript: StoryObj<typeof Heading> = {
  args: { menu: menuItems, isLoading: false },
  globals: { sb_theme: 'light' },
  decorators: [
    withBrand({
      title: `${titleWithScript}<a href="https://example.com" target="_blank">Docs</a>`,
      url: null,
      image: null,
      target: undefined,
    }),
  ],
  beforeEach: () => {
    delete xssWindow.__brandXss;
  },
  play: async ({ canvasElement }) => {
    await expectTitleSanitized(canvasElement);
    // `target` is kept, so links in a custom title still open in a new tab.
    await expect(within(canvasElement).getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'target',
      '_blank'
    );
  },
};

export const CustomTitleWithScriptAndLink: StoryObj<typeof Heading> = {
  ...CustomTitleWithScript,
  decorators: [
    withBrand({
      title: titleWithScript,
      url: 'https://example.com',
      image: null,
      target: undefined,
    }),
  ],
  play: async ({ canvasElement }) => {
    await expectTitleSanitized(canvasElement);
    await expect(within(canvasElement).getByText('My custom title').closest('a')).toHaveAttribute(
      'href',
      'https://example.com'
    );
  },
};

export const CustomBrandImage: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My Title',
          url: 'https://example.com',
          image: 'https://storybook.js.org/images/placeholders/150x22.png',
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const CustomBrandImageTall: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My Title',
          url: 'https://example.com',
          image: 'https://storybook.js.org/images/placeholders/100x150.png',
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const CustomBrandImageUnsizedSVG: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: 'My Title',
          url: 'https://example.com',
          image: 'https://s.cdpn.io/91525/potofgold.svg',
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const NoBrand: Story = () => {
  const theme = useTheme() as Theme;
  return (
    <ThemeProvider
      theme={{
        ...theme,
        brand: {
          title: undefined,
          url: null,
          image: null,
          target: undefined,
        },
      }}
    >
      <Heading menu={menuItems} isLoading={false} />
    </ThemeProvider>
  );
};

export const SkipToCanvasLinkFocused: StoryObj<typeof Heading> = {
  args: {
    menu: menuItems,
    skipLinkHref: '#storybook-preview-wrapper',
    isLoading: false,
  },
  globals: { sb_theme: 'light' },
  parameters: { layout: 'padded', chromatic: { delay: 300 } },
  play: () => {
    // focus each instance for chromatic/storybook's stacked theme
    screen.getAllByText('Skip to content').forEach((x) => x.focus());
  },
};
