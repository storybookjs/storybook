import type { FC } from 'react';
import React from 'react';

import { Select } from 'storybook/internal/components';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Icons } from '../../components/components/icon/icon';
import type { ToolbarItem, ToolbarMenuProps } from '../types';
import { getSelectedItem } from '../utils/get-selected';
import { registerShortcuts } from '../utils/register-shortcuts';

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

export const ToolbarMenuSelect: FC<ToolbarMenuProps> = ({
  id,
  name,
  description,
  toolbar: { icon: _icon, items, title: _title, preventDynamicIcon, dynamicTitle, shortcuts },
}) => {
  const api = useStorybookApi();
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const currentValue = globals[id];
  const isOverridden = id in storyGlobals;
  let icon = _icon;
  let title = _title;

  if (!preventDynamicIcon) {
    icon = getSelectedItem({ currentValue, items })?.icon || icon;
  }

  if (dynamicTitle) {
    title = getSelectedItem({ currentValue, items })?.title || title;
  }

  if (!title && !icon) {
    console.warn(`Toolbar '${name}' has no title or icon`);
  }

  const resetItem = items.find((item) => item.type === 'reset');
  const resetLabel = resetItem?.title;
  const options = React.useMemo(
    () =>
      items
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
        }),
    [items]
  );

  React.useEffect(() => {
    if (shortcuts) {
      const length = options.length;
      void registerShortcuts(api, id, {
        next: {
          ...shortcuts.next,
          action: () => {
            const idx = options.findIndex((i) => i.value === globals[id]);
            const nextIdx = idx < 0 ? 0 : (idx + 1) % length;
            updateGlobals({ [id]: options[nextIdx].value });
          },
        },
        previous: {
          ...shortcuts.previous,
          action: () => {
            const idx = options.findIndex((i) => i.value === globals[id]);
            const previousIdx = idx < 0 ? length - 1 : (idx + length - 1) % length;
            updateGlobals({ [id]: options[previousIdx].value });
          },
        },
        reset: {
          ...shortcuts.reset,
          action: () => {
            updateGlobals({ [id]: undefined });
          },
        },
      });
    }
  }, [api, id, shortcuts, globals, options, updateGlobals]);

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
      onReset={resetItem ? () => updateGlobals({ [id]: resetItem?.value }) : undefined}
      onSelect={(selected) => updateGlobals({ [id]: selected })}
      icon={icon && <Icons icon={icon} __suppressDeprecationWarning={true} />}
    >
      {title}
    </Select>
  );
};
