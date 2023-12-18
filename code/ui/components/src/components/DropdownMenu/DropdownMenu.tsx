import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import React from 'react';
import { styled } from '@storybook/theming';
import { rgba, transparentize } from 'polished';
import { CustomMenuItem } from './CustomMenuItem';

const StyledContent = styled(DropdownMenuPrimitive.Content)(({ theme }) => ({
  minWidth: 180,
  overflowX: 'hidden',
  overflowY: 'auto',
  zIndex: 3,
  maxHeight: 15.5 * 32, // 11.5 items
  backgroundColor: theme.base === 'light' ? theme.color.lightest : theme.background.app,
  borderRadius: theme.appBorderRadius,
  boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.10), 0px 0px 15px 0px rgba(0, 0, 0, 0.05)',
}));

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <StyledContent ref={ref} {...props}>
    {children}
  </StyledContent>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

const StyledTrigger = styled(DropdownMenuPrimitive.Trigger)(({ theme }) => ({
  '&[aria-expanded="true"]': {
    backgroundColor: transparentize(0.86, theme.color.secondary),
  },
}));

const StyledSeparator = styled(DropdownMenuPrimitive.Separator)(({ theme }) => ({
  height: '4px',
  backgroundColor: theme.base === 'light' ? '#DCE4E8' : '#393A3B',
}));

const StyledDropdownMenuItem = styled(DropdownMenuPrimitive.Item)(({ theme }) => ({
  '&:focus': {
    boxShadow: `${rgba(theme.color.secondary, 1)} 0 0 0 1px inset`,
    outline: 'none',
  },

  '&:first-child': {
    borderStartStartRadius: theme.appBorderRadius,
    borderStartEndRadius: theme.appBorderRadius,
  },

  '&:last-child': {
    borderEndStartRadius: theme.appBorderRadius,
    borderEndEndRadius: theme.appBorderRadius,
  },
}));

export type DropdownMenuItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>,
  'children'
> &
  React.ComponentProps<typeof CustomMenuItem>;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(
  (
    {
      label,
      description,
      active,
      disabled,
      keyboardShortcut,
      icon,
      startInlineIndent = true,
      onClick,
      ...props
    },
    ref
  ) => (
    <StyledDropdownMenuItem
      {...props}
      disabled={disabled}
      ref={ref}
      onClick={(event) => {
        /**
         * Workaround due to focus management limitation in DropdownMenu
         * More information here: https://github.com/radix-ui/primitives/issues/1446#issuecomment-1766741242
         */
        setTimeout(() => {
          onClick(event);
        }, 1);
      }}
    >
      <CustomMenuItem
        label={label}
        description={description}
        active={active}
        disabled={disabled}
        icon={icon}
        startInlineIndent={startInlineIndent}
        keyboardShortcut={keyboardShortcut}
      />
    </StyledDropdownMenuItem>
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

const StyledDropdownMenuCheckboxItem = styled(DropdownMenuPrimitive.CheckboxItem)(({ theme }) => ({
  '&:focus': {
    boxShadow: `${rgba(theme.color.secondary, 1)} 0 0 0 1px inset`,
    outline: 'none',
  },

  '&:first-child': {
    borderStartStartRadius: theme.appBorderRadius,
    borderStartEndRadius: theme.appBorderRadius,
  },

  '&:last-child': {
    borderEndStartRadius: theme.appBorderRadius,
    borderEndEndRadius: theme.appBorderRadius,
  },
}));

type DropdownMenuCheckboxItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  'children' | 'checked'
> &
  Omit<React.ComponentProps<typeof CustomMenuItem>, 'active'> & {
    checked?: boolean;
  };

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(
  (
    {
      label,
      description,
      disabled,
      keyboardShortcut,
      icon,
      checked = false,
      startInlineIndent,
      onCheckedChange,
      ...props
    },
    ref
  ) => (
    <StyledDropdownMenuCheckboxItem {...props} disabled={disabled} ref={ref} checked={checked}>
      <CustomMenuItem
        label={label}
        description={description}
        active={checked}
        disabled={disabled}
        icon={checked === false ? icon : 'check'}
        startInlineIndent={checked === false && !icon ? true : startInlineIndent}
        keyboardShortcut={keyboardShortcut}
      />
    </StyledDropdownMenuCheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenu = {
  ...DropdownMenuPrimitive,
  Root: DropdownMenuPrimitive.Root,
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  Content: DropdownMenuContent,
  Trigger: StyledTrigger,
  Separator: StyledSeparator,
};
