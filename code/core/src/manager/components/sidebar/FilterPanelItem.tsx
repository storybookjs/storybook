import React from 'react';

import { ActionList, Form } from 'storybook/internal/components';

import { DeleteIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList';
import type { FilterItem } from './FilterPanel.utils';

const MutedText = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

export const FilterPanelItem = ({
  id,
  type,
  title,
  count,
  icon,
  isIncluded,
  isExcluded,
  onCheckboxChange,
  onInvert,
}: FilterItem): Link => {
  const isChecked = isIncluded || isExcluded;
  const toggleLabel = `${type} filter: ${isExcluded ? `exclude ${title}` : title}`;
  const toggleTooltip = `${isChecked ? 'Remove' : 'Add'} ${type} filter: ${title}`;
  const invertButtonLabel = `${isExcluded ? 'Include' : 'Exclude'} ${type}: ${title}`;

  return {
    id: `filter-${type}-${id}`,
    content: (
      <ActionList.HoverItem targetId={`filter-${type}-${id}`}>
        <ActionList.Action as="label" ariaLabel={false} tabIndex={-1} tooltip={toggleTooltip}>
          <ActionList.Icon>
            {isExcluded ? <DeleteIcon /> : isIncluded ? null : icon}
            <Form.Checkbox
              checked={isChecked}
              onChange={onCheckboxChange}
              data-tag={title}
              aria-label={toggleLabel}
            />
          </ActionList.Icon>
          <ActionList.Text>
            <span>
              {title}
              {isExcluded && <MutedText> (excluded)</MutedText>}
            </span>
          </ActionList.Text>
          {isExcluded ? <s>{count}</s> : <span>{count}</span>}
        </ActionList.Action>
        <ActionList.Button
          data-target-id={`filter-${type}-${id}`}
          ariaLabel={invertButtonLabel}
          onClick={onInvert}
        >
          <span style={{ minWidth: 45 }}>{isExcluded ? 'Include' : 'Exclude'}</span>
        </ActionList.Button>
      </ActionList.HoverItem>
    ),
  };
};
