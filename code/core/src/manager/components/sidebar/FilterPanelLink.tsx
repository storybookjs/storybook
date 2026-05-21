import React from 'react';

import { ActionList, Form } from 'storybook/internal/components';

import { DeleteIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import {
  type FilterItem,
  type FilterPreviewAction,
  formatFilterDelta,
  getFilterPreviewDescription,
} from './FilterPanel.utils.ts';

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Count = styled.span(({ theme }) => ({
  minWidth: 36,
  textAlign: 'end',
  fontVariantNumeric: 'tabular-nums',
  color: theme.textMutedColor,
}));

const getDeltaColor = (
  delta: number,
  theme: { color: { negative: string; positive: string; secondary: string } }
) => (delta > 0 ? theme.color.positive : delta < 0 ? theme.color.negative : 'inherit');

const Delta = styled(Count)<{ $delta: number }>(({ theme, $delta }) => ({
  color: getDeltaColor($delta, theme),
}));

const getItemText = (count: number) => `item${count === 1 ? '' : 's'}`;

export const StatusIcon = styled.span<{ $iconColor?: string | null }>(({ $iconColor }) => ({
  display: 'contents',
  color: $iconColor ?? undefined,
  '> svg': {
    transform: 'scale(1.3)',
  },
}));

const getActionCopy = (item: FilterItem, action: FilterPreviewAction) => {
  const projection = item[action];
  const description = getFilterPreviewDescription(item, action);
  const absoluteDelta = Math.abs(projection.delta);
  const deltaText = `${absoluteDelta} ${getItemText(absoluteDelta)} would be ${
    projection.delta >= 0 ? 'added' : 'removed'
  }`;

  return {
    ariaLabel: `${description}. ${deltaText}.`,
    tooltip: `${description} (${projection.delta ? `${formatFilterDelta(projection.delta)} items` : 'no change'})`,
  };
};

export const createFilterLink = (
  item: FilterItem,
  {
    activePreviewAction,
    onPreviewEnd,
    onPreviewStart,
  }: {
    activePreviewAction: FilterPreviewAction | null;
    onPreviewEnd: () => void;
    onPreviewStart: (action: FilterPreviewAction) => void;
  }
): Link => {
  const {
    id,
    type,
    title,
    visibleCount,
    toggle,
    invert,
    icon,
    isIncluded,
    isExcluded,
    onCheckboxChange,
    onInvert,
  } = item;
  const isChecked = isIncluded || isExcluded;
  const toggleAction = getActionCopy(item, 'toggle');
  const invertAction = getActionCopy(item, 'invert');
  const activeProjection = activePreviewAction
    ? activePreviewAction === 'toggle'
      ? toggle
      : invert
    : null;
  const valueText = activeProjection
    ? formatFilterDelta(activeProjection.delta)
    : `${visibleCount}`;
  const valueAriaLabel = activeProjection
    ? `${Math.abs(activeProjection.delta)} ${getItemText(
        Math.abs(activeProjection.delta)
      )} would be ${activeProjection.delta >= 0 ? 'added' : 'removed'}`
    : `${visibleCount} ${getItemText(visibleCount)} currently shown`;

  return {
    id: `filter-${type}-${id}`,
    content: (
      <ActionList.HoverItem targetId={`filter-${type}-${id}`}>
        <ActionList.Action
          as="label"
          ariaLabel={false}
          tabIndex={-1}
          tooltip={toggleAction.tooltip}
          onBlurCapture={onPreviewEnd}
          onFocusCapture={() => onPreviewStart('toggle')}
          onMouseEnter={() => onPreviewStart('toggle')}
          onMouseLeave={onPreviewEnd}
        >
          <ActionList.Icon>
            {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
            <Form.Checkbox
              checked={isChecked}
              onChange={onCheckboxChange}
              data-tag={title}
              aria-label={toggleAction.ariaLabel}
            />
          </ActionList.Icon>
          <ActionList.Text>
            <span>
              {title}
              {isExcluded && <MutedText> (excluded)</MutedText>}
            </span>
          </ActionList.Text>
          {activeProjection ? (
            activeProjection.delta ? (
              <Delta aria-label={valueAriaLabel} $delta={activeProjection.delta}>
                <span aria-hidden>{valueText}</span>
              </Delta>
            ) : null
          ) : (
            <Count aria-label={valueAriaLabel}>
              <span aria-hidden>{valueText}</span>
            </Count>
          )}
        </ActionList.Action>
        <ActionList.Button
          data-target-id={`filter-${type}-${id}`}
          ariaLabel={invertAction.ariaLabel}
          onClick={onInvert}
          tooltip={invertAction.tooltip}
          onBlur={onPreviewEnd}
          onFocus={() => onPreviewStart('invert')}
          onMouseEnter={() => onPreviewStart('invert')}
          onMouseLeave={onPreviewEnd}
        >
          <span style={{ minWidth: 45 }}>{isExcluded ? 'Include' : 'Exclude'}</span>
        </ActionList.Button>
      </ActionList.HoverItem>
    ),
  };
};
