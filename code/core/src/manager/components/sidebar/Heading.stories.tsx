// @TODO: use addon-interactions and remove the rule disable above
import React from 'react';

import { ThemeProvider, useTheme } from '@storybook/core/theming';
import type { Theme } from '@storybook/core/theming';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { screen } from '@storybook/test';

import { action } from '@storybook/addon-actions';

import { Heading } from './Heading';

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
} as Meta<typeof Heading>;

const menuItems = [
  { title: 'Menu Item 1', onClick: action('onActivateMenuItem'), id: '1' },
  { title: 'Menu Item 2', onClick: action('onActivateMenuItem'), id: '2' },
  { title: 'Menu Item 3', onClick: action('onActivateMenuItem'), id: '3' },
];

export const MenuHighlighted: Story = () => (
  <Heading menuHighlighted menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
    </ThemeProvider>
  );
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
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
      <Heading menu={menuItems} isLoading={false} extra={[]} />
    </ThemeProvider>
  );
};

export const SkipToCanvasLinkFocused: StoryObj<typeof Heading> = {
  args: {
    menu: menuItems,
    skipLinkHref: '#storybook-preview-wrapper',
    extra: [],
    isLoading: false,
  },
  globals: { sb_theme: 'light' },
  parameters: { layout: 'padded', chromatic: { delay: 300 } },
  play: () => {
    // focus each instance for chromatic/storybook's stacked theme
    screen.getAllByText('Skip to canvas').forEach((x) => x.focus());
  },
};
