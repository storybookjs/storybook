import React from 'react';

import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { Bar } from './Bar';

const Wrapper = styled.div({
  background: 'var(--sb-background-app)',
  border: `1px solid var(--sb-appBorderColor)`,
  maxWidth: 500,
  height: 200,
});

const meta = preview.meta({
  component: Bar,
  title: 'Bar/Bar',
  decorators: [
    (Story) => (
      <Wrapper>
        <Story />
      </Wrapper>
    ),
  ],
});

export default meta;

const LongContent = () =>
  Array.from({ length: 12 }).map((_, i) => (
    <div key={i} style={{ padding: '0 8px' }}>
      Item {i + 1}
    </div>
  ));

export const Default = meta.story({ args: { children: 'Default' } });

export const Bordered = meta.story({
  args: { border: true, children: 'Bar with border' },
});

export const BackgroundBorderless = meta.story({
  args: { backgroundColor: '#f3f4f6', border: false, children: 'Bar with custom background' },
  globals: {
    sb_theme: 'light',
  },
});

export const BackgroundBordered = meta.story({
  args: { backgroundColor: '#f3f4f6', border: true, children: 'Bar with custom background' },
  globals: {
    sb_theme: 'light',
  },
});

export const NonScrollable = meta.story({
  name: 'Non-scrollable',
  args: {
    children: 'Non-scrollable Bar',
    scrollable: false,
  },
});

export const Scrollable = meta.story({
  args: { scrollable: true, children: <LongContent /> },
});

export const ScrollableBordered = meta.story({
  name: 'Scrollable bordered',
  args: {
    border: true,
    children: <LongContent />,
    innerStyle: { justifyContent: 'start' },
    scrollable: true,
  },
});

export const ScrollableBackground = meta.story({
  name: 'Scrollable background',
  args: {
    backgroundColor: '#f3f4f6',
    border: false,
    children: <LongContent />,
    innerStyle: { justifyContent: 'start' },
    scrollable: true,
  },
  globals: {
    sb_theme: 'light',
  },
});

export const ScrollableBackgroundBordered = meta.story({
  name: 'Scrollable background bordered',
  args: {
    backgroundColor: '#f3f4f6',
    border: true,
    children: <LongContent />,
    innerStyle: { justifyContent: 'start' },
    scrollable: true,
  },
  globals: {
    sb_theme: 'light',
  },
});

export const InnerStyleOverride = meta.story({
  args: {
    children: <div style={{ padding: '0 8px' }}>Custom inner style</div>,
    innerStyle: { backgroundColor: '#fff7ed', gap: 12 },
  },
  globals: {
    sb_theme: 'light',
  },
});
