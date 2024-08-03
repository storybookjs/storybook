import type { FC } from 'react';
import React, { useState, useCallback } from 'react';
import { useGlobals } from 'storybook/internal/manager-api';
import { WithTooltip, TooltipLinkList } from 'storybook/internal/components';
import { ToolbarMenuButton } from './ToolbarMenuButton';
import type { WithKeyboardCycleProps } from '../hoc/withKeyboardCycle';
import { withKeyboardCycle } from '../hoc/withKeyboardCycle';
import { getSelectedIcon, getSelectedTitle } from '../utils/get-selected';
import type { ToolbarMenuProps } from '../types';
import { ToolbarMenuListItem } from './ToolbarMenuListItem';

type ToolbarMenuListProps = ToolbarMenuProps & WithKeyboardCycleProps;

export const ToolbarMenuList: FC<ToolbarMenuListProps> = withKeyboardCycle(
  ({
    id,
    name,
    description,
    toolbar: { icon: _icon, items, title: _title, preventDynamicIcon, dynamicTitle },
  }) => {
    const [globals, updateGlobals, storyGlobals] = useGlobals();
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    const currentValue = globals[id];
    const hasGlobalValue = !!currentValue;
    const isOverridden = id in storyGlobals;
    let icon = _icon;
    let title = _title;

    if (!preventDynamicIcon) {
      icon = getSelectedIcon({ currentValue, items }) || icon;
    }

    if (dynamicTitle) {
      title = getSelectedTitle({ currentValue, items }) || title;
    }

    if (!title && !icon) {
      console.warn(`Toolbar '${name}' has no title or icon`);
    }

    const handleItemClick = useCallback(
      (value: string | undefined) => {
        updateGlobals({ [id]: value });
      },
      [id, updateGlobals]
    );

    return (
      <WithTooltip
        placement="top"
        tooltip={({ onHide }) => {
          const links = items
            // Special case handling for various "type" variants
            .filter(({ type }) => {
              let shouldReturn = true;

              if (type === 'reset' && !currentValue) {
                shouldReturn = false;
              }

              return shouldReturn;
            })
            .map((item) => {
              const listItem = ToolbarMenuListItem({
                ...item,
                currentValue,
                disabled: isOverridden,
                onClick: () => {
                  handleItemClick(item.value);
                  onHide();
                },
              });

              return listItem;
            });
          return <TooltipLinkList links={links} />;
        }}
        closeOnOutsideClick
        onVisibleChange={setIsTooltipVisible}
      >
        {
          <ToolbarMenuButton
            active={isTooltipVisible || hasGlobalValue}
            disabled={isOverridden}
            description={description || ''}
            icon={icon}
            title={title || ''}
          />
        }
      </WithTooltip>
    );
  }
);
