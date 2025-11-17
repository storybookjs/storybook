import React from 'react';

import { styled } from 'storybook/theming';

import preview from '../../../../../../.storybook/preview';
import { InteractiveTooltipWrapper } from './InteractiveTooltipWrapper';

const meta = preview.meta({
  id: 'interactive-tooltip-wrapper-component',
  title: 'InteractiveTooltipWrapper',
  component: InteractiveTooltipWrapper,
  args: { children: <button>Hover me</button> },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const All = meta.story({
  render: () => (
    <Stack>
      <Row>
        <InteractiveTooltipWrapper>
          <button>No tooltip</button>
        </InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper tooltip="Save">
          <button>Tooltip</button>
        </InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper shortcut={['Ctrl', 'S']}>
          <button>Shortcut</button>
        </InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper tooltip="Save" shortcut={['Ctrl', 'S']}>
          <button>Tooltip and shortcut</button>
        </InteractiveTooltipWrapper>
      </Row>
    </Stack>
  ),
});

export const Empty = meta.story({
  args: {},
});

export const Tooltip = meta.story({
  args: {
    tooltip: 'Save',
  },
});

export const Shortcut = meta.story({
  args: {
    shortcut: ['Ctrl', 'S'],
  },
});
export const TooltipAndShortcut = meta.story({
  args: {
    shortcut: ['Ctrl', 'S'],
    tooltip: 'Save',
  },
});
