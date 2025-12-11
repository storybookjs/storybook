import type { FC } from 'react';
import React from 'react';

import { Select } from 'storybook/internal/components';

import { useGlobals } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Icons } from '../../components/components/icon/icon';
import type { WithKeyboardCycleProps } from '../hoc/withKeyboardCycle';
import { withKeyboardCycle } from '../hoc/withKeyboardCycle';
import type { ToolbarItem, ToolbarMenuProps } from '../types';
import { getSelectedIcon } from '../utils/get-selected';

// We can't remove the Icons component just yet because there's no way for now to import icons
// in the preview directly. Before having a better solution, we are going to keep the Icons component
// for now and remove the deprecated warning.

const ToolbarMenuItemContainer = styled('div')({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
const ToolbarMenuItemMiddle = styled('div')({
  flex: 1,
});

type ToolbarMenuSelectProps = ToolbarMenuProps & WithKeyboardCycleProps;

export const ToolbarMenuSelect: FC<ToolbarMenuSelectProps> = withKeyboardCycle(
  ({
    id,
    name,
    description,
    toolbar: { icon: _icon, items, title, preventDynamicIcon, dynamicTitle = true },
  }) => {
    const [globals, updateGlobals, storyGlobals] = useGlobals();

    const currentValue = globals[id];
    const isOverridden = id in storyGlobals;
    let icon = _icon;

    if (!preventDynamicIcon) {
      icon = getSelectedIcon({ currentValue, items }) || icon;
    }

    if (!title && !icon) {
      console.warn(`Toolbar '${name}' has no title or icon`);
    }

    const resetItem = items.find((item) => item.type === 'reset');
    const resetLabel = resetItem?.title;
    const options = items
      .filter((item): item is ToolbarItem => item.type === 'item')
      .map((item) => {
        const itemTitle = item.title ?? item.value ?? 'Untitled';
        const iconComponent =
          !item.hideIcon && item.icon ? (
            <Icons icon={item.icon} __suppressDeprecationWarning={true} />
          ) : undefined;

        if (item.right) {
          return {
            title: itemTitle,
            value: item.value,
            children: (
              <ToolbarMenuItemContainer>
                {iconComponent}
                <ToolbarMenuItemMiddle>{item.title ?? item.value}</ToolbarMenuItemMiddle>
                {item.right}
              </ToolbarMenuItemContainer>
            ),
          };
        } else {
          return {
            title: itemTitle,
            value: item.value,
            icon: iconComponent,
          };
        }
      });

    // FIXME: for SB 10 we would want description to become an aria-description, and to add an
    // ariaLabel prop to tools with an automigration switching current description to ariaLabel
    const ariaLabel = description || title || name || id;

    return (
      <Select
        defaultOptions={[currentValue]}
        options={options}
        disabled={isOverridden}
        ariaLabel={ariaLabel}
        tooltip={ariaLabel}
        resetLabel={resetLabel}
        onReset={() => updateGlobals({ [id]: '_reset' })}
        onSelect={(selected) => updateGlobals({ [id]: selected })}
        icon={icon && <Icons icon={icon} __suppressDeprecationWarning={true} />}
        showSelectedOptionTitle={dynamicTitle}
      >
        {title}
      </Select>
    );
  }
);
