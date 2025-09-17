import type { DOMAttributes, ReactElement } from 'react';
import React, { useMemo } from 'react';

import { Popover, convertToReactAriaPlacement } from 'storybook/internal/components';
import type { MenuItemProps, PopperPlacement } from 'storybook/internal/components';

import {
  Menu,
  MenuTrigger,
  Popover as PopoverUpstream,
  Pressable,
  Separator,
  type SeparatorProps,
} from 'react-aria-components';
import { styled } from 'storybook/theming';

import { MenuItem } from './MenuItem';

type MenuItemChild = Omit<MenuItemProps, 'isIndented'> & { type?: 'item' };
type SeparatorChild = SeparatorProps & { type: 'separator' };

// Cancelling a default outline that occurs on the MenuTrigger container with react-aria.
const StyledMenu = styled(Menu)({
  '&:focus': {
    outline: 'none',
  },
});

const StyledSeparator = styled(Separator)(({ theme }) => ({
  border: 'none',
  borderTop: `1px solid ${theme.base === 'light' ? '#264A7326' : '#FFFFFF12'}`,
  margin: '4px 0',
}));

export interface WithMenuProps {
  /** Distance between the trigger and Menu. Customize only if you have a good reason to. */
  offset?: number;

  /**
   * Placement of the Menu. Start and End variants involve additional JS dimension calculations and
   * should be used sparingly. Left and Right get inverted in RTL.
   */
  placement?: PopperPlacement;

  /** Items in the menu. */
  items: (MenuItemChild | SeparatorChild)[];

  /** Menu trigger, must be a single child with click/press events. Must forward refs. */
  children: ReactElement<DOMAttributes<Element>, string>;

  /** Uncontrolled state: whether the Menu is initially visible. */
  defaultVisible?: boolean;

  /** Controlled state: whether the Menu is visible. */
  visible?: boolean;

  /** Controlled state: fires when user interaction causes the Menu to change visibility. */
  onVisibleChange?: (isVisible: boolean) => void;
}

function isSeparator(item: MenuItemChild | SeparatorChild): item is SeparatorChild {
  return item.type === 'separator';
}

export const WithMenu = ({
  placement: placementProp = 'bottom-start',
  offset = 8,
  items,
  children,
  defaultVisible,
  visible,
  onVisibleChange,
  ...props
}: WithMenuProps) => {
  // Map Popper.js placement to react-aria placement best we can.
  const placement = convertToReactAriaPlacement(placementProp);

  const hasIcons = useMemo(() => items.some((item) => 'icon' in item), [items]);

  return (
    <MenuTrigger
      defaultOpen={defaultVisible}
      isOpen={visible}
      onOpenChange={onVisibleChange}
      {...props}
    >
      <Pressable>{children}</Pressable>
      <PopoverUpstream
        placement={placement}
        offset={offset}
        style={{ outlineColor: 'transparent' }}
      >
        <Popover hasChrome padding="4px 0">
          <StyledMenu>
            {items.map((item, index) => {
              return isSeparator(item) ? (
                <StyledSeparator key={index} />
              ) : (
                <MenuItem key={item.id} {...item} isIndented={hasIcons} />
              );
            })}
          </StyledMenu>
        </Popover>
      </PopoverUpstream>
    </MenuTrigger>
  );
};
