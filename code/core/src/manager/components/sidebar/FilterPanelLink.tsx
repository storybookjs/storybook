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

const Delta = styled(Count)<{ $delta: number }>(({ theme, $delta }) => ({
  color:
    $delta > 0 ? theme.color.positive : $delta < 0 ? theme.color.negative : theme.color.secondary,
}));

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
  const deltaText = `${Math.abs(projection.delta)} item${Math.abs(projection.delta) === 1 ? '' : 's'} would be ${
    projection.delta >= 0 ? 'added' : 'removed'
  }`;

  return {
    ariaLabel: `${description}. ${deltaText}.`,
    tooltip: `${description} (${formatFilterDelta(projection.delta)} items)`,
  };
};

export const createFilterLink = (
  {
    id,
    type,
    title,
    count,
    visibleCount,
    toggle,
    invert,
    icon,
    isIncluded,
    isExcluded,
    onCheckboxChange,
    onInvert,
  }: FilterItem,
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
  const isChecked = isIncluded || isExcluded;
  const toggleAction = getActionCopy(
    {
      id,
      type,
      title,
      count,
      visibleCount,
      toggle,
      invert,
      icon,
      isIncluded,
      isExcluded,
      onCheckboxChange,
      onInvert,
    },
    'toggle'
  );
  const invertAction = getActionCopy(
    {
      id,
      type,
      title,
      count,
      visibleCount,
      toggle,
      invert,
      icon,
      isIncluded,
      isExcluded,
      onCheckboxChange,
      onInvert,
    },
    'invert'
  );
  const activeProjection = activePreviewAction
    ? activePreviewAction === 'toggle'
      ? toggle
      : invert
    : null;
  const valueText = activeProjection
    ? formatFilterDelta(activeProjection.delta)
    : `${visibleCount}`;
  const valueAriaLabel = activeProjection
    ? `${Math.abs(activeProjection.delta)} item${
        Math.abs(activeProjection.delta) === 1 ? '' : 's'
      } would be ${activeProjection.delta >= 0 ? 'added' : 'removed'}`
    : `${visibleCount} item${visibleCount === 1 ? '' : 's'} currently shown`;

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
            <Delta aria-label={valueAriaLabel} $delta={activeProjection.delta}>
              <span aria-hidden>{valueText}</span>
            </Delta>
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
