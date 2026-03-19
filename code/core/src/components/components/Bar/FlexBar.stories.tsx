import React from 'react';

import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { FlexBar } from './Bar';

const meta = preview.meta({ component: FlexBar, title: 'Bar/FlexBar (deprecated)' });

export default meta;

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const LongContent = () =>
  Array.from({ length: 12 }).map((_, i) => (
    <div key={i} style={{ padding: '0 8px' }}>
      Item {i + 1}
    </div>
  ));

export const Default = meta.story({
  render: (args) => (
    <FlexBar {...args}>
      <Row>Left content</Row>
      <Row>Right content</Row>
    </FlexBar>
  ),
});

export const OnlyLeft = meta.story({
  render: (args) => (
    <FlexBar {...args}>
      <Row>Only left</Row>
    </FlexBar>
  ),
});

export const OnlyRight = meta.story({
  render: (args) => (
    <FlexBar {...args}>
      <Row></Row>
      <Row>Only right</Row>
    </FlexBar>
  ),
});

export const Background = meta.story({
  args: {
    backgroundColor: '#f3f4f6',
  },
  globals: {
    sb_theme: 'light',
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>Left content</Row>
      <Row>Right content</Row>
    </FlexBar>
  ),
});

export const Border = meta.story({
  args: {
    border: true,
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>Left content</Row>
      <Row>Right content</Row>
    </FlexBar>
  ),
});

export const BackgroundBorder = meta.story({
  args: {
    backgroundColor: '#f3f4f6',
    border: true,
  },
  globals: {
    sb_theme: 'light',
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>Left content</Row>
      <Row>Right content</Row>
    </FlexBar>
  ),
});

export const ScrollableBackground = meta.story({
  args: {
    backgroundColor: '#f3f4f6',
    scrollable: true,
  },
  globals: {
    sb_theme: 'light',
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>
        <LongContent />
      </Row>
      <Row>
        <LongContent />
      </Row>
    </FlexBar>
  ),
});

export const ScrollableBorder = meta.story({
  args: {
    border: true,
    scrollable: true,
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>
        <LongContent />
      </Row>
      <Row>
        <LongContent />
      </Row>
    </FlexBar>
  ),
});

export const ScrollableBackgroundBorder = meta.story({
  args: {
    backgroundColor: '#f3f4f6',
    border: true,
    scrollable: true,
  },
  globals: {
    sb_theme: 'light',
  },
  render: (args) => (
    <FlexBar {...args}>
      <Row>
        <LongContent />
      </Row>
      <Row>
        <LongContent />
      </Row>
    </FlexBar>
  ),
});
