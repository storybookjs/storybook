import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';

import { styled } from 'storybook/theming';

import { IconSymbols, UseSymbol } from './IconSymbols.tsx';
import { TypeIcon } from './TypeIcon.tsx';

const TYPE_ICON_TYPES = ['group', 'component', 'docs', 'story', 'test'] as const;
const STATUS_ICON_TYPES = [
  'success',
  'error',
  'warning',
  'dot',
  'change-new',
  'reviewing',
  'change-modified',
  'change-affected',
] as const;

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 16,
  padding: 16,
});

const Item = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
});

const Label = styled.span(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.color.mediumdark,
}));

const StatusIcon = styled.svg(({ theme }) => ({
  width: 14,
  height: 14,
  color: theme.color.defaultText,
}));

const meta = {
  component: IconSymbols,
  title: 'Sidebar/IconSymbols',
  parameters: { layout: 'padded' },
  decorators: [
    (StoryFn) => (
      <>
        <IconSymbols />
        <StoryFn />
      </>
    ),
  ],
} satisfies Meta<typeof IconSymbols>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Grid>
      {TYPE_ICON_TYPES.map((type) => (
        <Item key={type}>
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type={type}>
            <UseSymbol type={type} />
          </TypeIcon>
          <Label>{type}</Label>
        </Item>
      ))}
      {STATUS_ICON_TYPES.map((type) => (
        <Item key={type}>
          <StatusIcon viewBox="0 0 14 14">
            <UseSymbol type={type} />
          </StatusIcon>
          <Label>{type}</Label>
        </Item>
      ))}
    </Grid>
  ),
};
