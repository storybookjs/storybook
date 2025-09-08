import React, { type FC, type ReactElement, type ReactNode, forwardRef } from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/internal/manager-api';

import { CheckIcon, ShareAltIcon } from '@storybook/icons';

import { MenuItem as MenuItemUpstream } from 'react-aria-components';
import { type MenuItemProps as MenuItemPropsUpstream } from 'react-aria-components';
import { styled } from 'storybook/theming';

const Root = styled(MenuItemUpstream)<{ isSelected: boolean }>(({ isSelected, theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',

  minHeight: 32,
  margin: '0 4px',
  padding: 8,
  gap: 8,

  color: isSelected
    ? theme.color.secondary
    : theme.base === 'light'
      ? theme.color.darkest
      : theme.color.lightest,
  textDecoration: 'none',

  transition: 'all 150ms ease-out',
  // Same as overlay withChrome
  borderRadius: theme.appBorderRadius + 2,

  '&:hover:not([aria-disabled="true"])': {
    background: theme.background.hoverable,
    color: theme.color.secondary,
    cursor: 'pointer',
  },
  '&:focus-visible:not([aria-disabled="true"])': {
    outline: 'none',
    background: theme.background.hoverable,
    color: theme.color.secondary,
    // boxShadow: `inset 0 0 0 2px ${theme.color.secondary}`,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
}));

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const Title = styled.div<{ isIndented: boolean; isSelected: boolean }>(
  ({ isIndented, isSelected, theme }) => ({
    flex: 1,
    fontWeight: isSelected ? 700 : 400,
    fontFamily: theme.typography.fonts.base,
    fontSize: theme.typography.size.s1,
    lineHeight: `${theme.typography.size.s3}px`,
    // 14px icon + 8px gap.
    marginInlineStart: isIndented ? 22 : undefined,
  })
);

const ExtraLabelText = styled.div<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  color: isSelected ? theme.color.secondary : theme.textMutedColor,
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  lineHeight: `${theme.typography.size.s3}px`,
}));

const Description = styled.div<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  color: isSelected ? theme.color.secondary : theme.textMutedColor,
  fontSize: 11,
  lineHeight: `${theme.typography.size.s3}px`,
}));

const HighlightPill = styled.div(({ theme }) => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: 9999,
  background: theme.color.positiveText,
}));

const ExtraLabel: FC<{
  shortcut?: API_KeyCollection;
  isDefault: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  showExternalIcon: boolean;
}> = ({ shortcut, isDefault, isHighlighted, isSelected, showExternalIcon }) => {
  const outputs = [];

  if (shortcut) {
    outputs.push(
      <ExtraLabelText isSelected={isSelected}>{shortcutToHumanString(shortcut)}</ExtraLabelText>
    );
  } else if (isDefault) {
    outputs.push(<ExtraLabelText isSelected={isSelected}>default</ExtraLabelText>);
  }

  if (isSelected) {
    outputs.push(<CheckIcon size={14} />);
  } else if (isHighlighted) {
    outputs.push(<HighlightPill />);
  } else if (showExternalIcon) {
    outputs.push(<ShareAltIcon size={14} />);
  }

  return <>{outputs}</>;
};

export interface MenuItemProps extends Omit<MenuItemPropsUpstream, 'children'> {
  /* --- Anatomy and layout --- */
  title: string;
  description?: ReactNode;
  icon?: ReactElement;
  isIndented?: boolean;

  /* --- Interactivity state --- */
  isLoading?: boolean;
  isDisabled?: boolean;

  /* --- Additional content types --- */
  isDefault?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  showExternalIcon?: boolean;

  /* --- Actions --- */
  href?: string;
  shortcut?: API_KeyCollection;
}

export const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
  (
    {
      title,
      description,
      icon,
      isIndented = false,
      isDefault = false,
      isDisabled = false,
      showExternalIcon = false,
      isHighlighted = false,
      isSelected = false,
      shortcut,
      ...props
    },
    ref
  ) => {
    return (
      <Root
        ref={ref}
        isDisabled={isDisabled}
        isSelected={isSelected}
        {...props}
        target={props.href ? '_blank' : undefined}
      >
        <Row>
          {icon && React.cloneElement(icon, { size: 14 })}
          <Title isIndented={isIndented && !icon} isSelected={isSelected}>
            {title}
          </Title>
          <ExtraLabel
            isDefault={isDefault}
            isHighlighted={isHighlighted}
            isSelected={isSelected}
            showExternalIcon={showExternalIcon}
            shortcut={shortcut}
          />
        </Row>
        {description && (
          <Row>
            <Description isSelected={isSelected}>{description}</Description>
          </Row>
        )}
      </Root>
    );
  }
);
MenuItem.displayName = 'MenuItem';
