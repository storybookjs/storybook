import type { FC } from 'react';
import React from 'react';

import { Select } from 'storybook/internal/components';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { ToolbarItem, ToolbarMenuProps } from '../types.ts';
import { getSelectedItem } from '../utils/get-selected.ts';
import { registerShortcuts } from '../utils/register-shortcuts.ts';

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
  toolbar: { items, title: _title, dynamicTitle = true, shortcuts },
}) => {
  const api = useStorybookApi();
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const currentValue = globals[id];
  const isOverridden = id in storyGlobals;
  let title = _title;

  if (dynamicTitle) {
    title = getSelectedItem({ currentValue, items })?.title || title;
  }

  if (!title) {
    console.warn(`Toolbar '${name}' has no title. String icon names no longer render.`);
  }

  const resetItem = items.find((item) => item.type === 'reset');
  const resetLabel = resetItem?.title;
  const options = React.useMemo(
    () =>
      items
        .filter((item): item is ToolbarItem => item.type === 'item')
        .map((item) => {
          const itemTitle = item.title ?? item.value ?? 'Untitled';

          if (item.right) {
            return {
              title: itemTitle,
              value: item.value,
              children: (
                <ToolbarMenuItemContainer>
                  <ToolbarMenuItemMiddle>{item.title ?? item.value}</ToolbarMenuItemMiddle>
                  {item.right}
                </ToolbarMenuItemContainer>
              ),
            };
          } else {
            return {
              title: itemTitle,
              value: item.value,
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
      showSelectedOptionTitle={dynamicTitle}
    >
      {title}
    </Select>
  );
};
