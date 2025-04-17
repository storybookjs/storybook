import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { results } from '../../results.mock';
import { RuleType } from '../../types';
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

const meta = preview.meta({
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
    handleSelectionChange: fn().mockName('handleSelectionChange'),
    selectedItems: new Map(),
    toggleOpen: fn().mockName('toggleOpen'),
  },
});

export const Empty = meta.story({});

export const Violations = meta.story({
  args: {
    items: results.violations,
    type: RuleType.VIOLATION,
    selectedItems: new Map([
      [
        `${RuleType.VIOLATION}.${results.violations[0].id}`,
        `${RuleType.VIOLATION}.${results.violations[0].id}.3`,
      ],
    ]),
  },
});

export const Incomplete = meta.story({
  args: {
    items: results.incomplete,
    type: RuleType.INCOMPLETION,
    selectedItems: new Map([
      [
        `${RuleType.INCOMPLETION}.${results.incomplete[1].id}`,
        `${RuleType.INCOMPLETION}.${results.incomplete[1].id}.2`,
      ],
    ]),
  },
});

export const Passes = meta.story({
  args: {
    items: results.passes,
    type: RuleType.PASS,
    selectedItems: new Map([
      [`${RuleType.PASS}.${results.passes[2].id}`, `${RuleType.PASS}.${results.passes[2].id}.1`],
    ]),
  },
});
