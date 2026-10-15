import type { FC, ReactElement } from 'react';
import React from 'react';

import { Select } from 'storybook/internal/components';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { ToolbarIconType, ToolbarMenuProps } from '../types.ts';
import { getSelectedItem } from '../utils/get-selected.ts';
import { registerShortcuts } from '../utils/register-shortcuts.ts';
import { ToolbarIcon } from './ToolbarIcon.tsx';

const ToolbarMenuItemContainer = styled('div')({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
const ToolbarMenuItemMiddle = styled('div')({
  flex: 1,
});

// `Select` renders its fixed icon slot for any option that carries an icon node, so an item
// without an icon — or with `hideIcon: true` — must resolve to `undefined`, not to an element
// that renders nothing.
const renderToolbarIcon = (name?: ToolbarIconType): ReactElement | undefined =>
  name ? <ToolbarIcon icon={name} /> : undefined;

export const ToolbarMenuSelect: FC<ToolbarMenuProps> = ({
  id,
  name,
  description,
  toolbar: {
    icon: toolbarIcon,
    items,
    title: toolbarTitle,
    preventDynamicIcon,
    dynamicTitle = true,
    shortcuts,
  },
}) => {
  const api = useStorybookApi();
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const currentValue = globals[id];
  const isOverridden = id in storyGlobals;
  const selected = getSelectedItem({ currentValue, items });
  const icon = preventDynamicIcon ? toolbarIcon : selected?.icon || toolbarIcon;
  const title = dynamicTitle ? selected?.title || toolbarTitle : toolbarTitle;

  if (!title && !icon) {
    console.warn(`Toolbar '${id}' has no title or icon`);
  }

  const resetItem = items.find((item) => item.type === 'reset');
  const resetLabel = resetItem?.title;
  const options = React.useMemo(
    () =>
      items
        .filter((item) => item.type !== 'reset')
        .map((item) => {
          const itemTitle = item.title ?? item.value ?? 'Untitled';
          const itemIcon = item.hideIcon ? undefined : item.icon;

          if (item.right) {
            return {
              title: itemTitle,
              value: item.value,
              children: (
                <ToolbarMenuItemContainer>
                  {renderToolbarIcon(itemIcon)}
                  <ToolbarMenuItemMiddle>{item.title ?? item.value}</ToolbarMenuItemMiddle>
                  {item.right}
                </ToolbarMenuItemContainer>
              ),
            };
          } else {
            return {
              title: itemTitle,
              value: item.value,
              icon: renderToolbarIcon(itemIcon),
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
      icon={renderToolbarIcon(icon)}
      showSelectedOptionTitle={dynamicTitle}
    >
      {title}
    </Select>
  );
};
