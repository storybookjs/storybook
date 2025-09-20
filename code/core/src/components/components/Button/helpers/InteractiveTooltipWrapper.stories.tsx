import React from 'react';

import { styled } from 'storybook/theming';

import preview from '../../../../../../.storybook/preview';
import { InteractiveTooltipWrapper } from './InteractiveTooltipWrapper';

const meta = preview.meta({
  id: 'interactive-tooltip-wrapper-component',
  title: 'InteractiveTooltipWrapper',
  component: InteractiveTooltipWrapper,
  args: { children: 'Hover me' },
});

const Stack = styled.div({ display: 'flex', flexDirection: 'column', gap: '1rem' });

const Row = styled.div({ display: 'flex', alignItems: 'center', gap: '1rem' });

export const All = meta.story({
  render: () => (
    <Stack>
      <Row>
        <InteractiveTooltipWrapper>No tooltip</InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper tooltip="Save">Tooltip</InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper shortcut={['Ctrl', 'S']}>Shortcut</InteractiveTooltipWrapper>
      </Row>
      <Row>
        <InteractiveTooltipWrapper tooltip="Save" shortcut={['Ctrl', 'S']}>
          Tooltip and shortcut
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
