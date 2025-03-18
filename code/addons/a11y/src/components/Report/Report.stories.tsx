import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { results } from '../../results.mock';
import { RuleType } from '../A11YPanel';
import { Report } from './Report';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  fontSize: theme.typography.size.s2 - 1,
  color: theme.color.defaultText,
  display: 'block',
  height: '100%',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto',
}));

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
  },
};

const meta: Meta = {
  title: 'Report',
  component: Report,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <StyledWrapper id="panel-tab-content">
          <Story />
        </StyledWrapper>
      </ManagerContext.Provider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    items: [],
    empty: 'No issues found',
    type: RuleType.VIOLATION,
    onSelectionChange: fn().mockName('onSelectionChange'),
    selectedItems: new Map(),
    toggleOpen: fn().mockName('toggleOpen'),
  },
} satisfies Meta<typeof Report>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Violations: Story = {
  args: {
    items: results.violations,
  },
};

export const Incomplete: Story = {
  args: {
    items: results.incomplete,
  },
};

export const Passes: Story = {
  args: {
    items: results.passes,
  },
};
