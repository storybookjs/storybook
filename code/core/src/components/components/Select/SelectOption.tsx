import React from 'react';

import { styled } from 'storybook/theming';

export interface SelectOptionProps {
  /**
   * DOM id attribute for the option, unique across the entire app. This is not the value of the
   * option. We don't need the value internally as it's handled in event handlers by the parent
   * component.
   */
  id: string;

  /** Label for the option (injected in aria-labels). */
  title: string;

  /** Secondary text or description not necessary to identify the option. */
  description?: string;

  /** Decorative icon. */
  icon?: React.ReactNode;

  /** Optional rendering of the option. Use sparingly. */
  children?: React.ReactNode;

  /** Whether the option has been selected by the user or programmatically. */
  isSelected: boolean;

  /** Whether the option is currently focused in the listbox. */
  isActive: boolean;

  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;

  /**
   * Whether to print out the option as if it could not be enabled. Does NOT prevent event handlers
   * from being called as we need them to implement keyboard navigation.
   */
  disabled: boolean;
}

const Item = styled('li')(({ theme }) => ({
  padding: '6px 12px',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 4,
  '&[aria-disabled="true"]': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  '&[aria-selected="true"]': {
    color: theme.color.secondary,
    fontWeight: theme.typography.weight.bold,
  },
  ':hover': {
    background: theme.background.hoverable,
  },
  ':focus-visible': {
    background: theme.background.hoverable,
    boxShadow: `inset 0 0 0 2px ${theme.color.ultraviolet}`,
    outline: 'none',
  },
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
}));

const Col = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
});

const Icon = styled('span')(() => ({
  display: 'block',
  height: '1rem',
  width: '1rem',
}));

const Title = styled('span')(() => ({}));

const Description = styled('span')(({ theme }) => ({
  fontSize: 11,
  color: theme.textMutedColor,
}));

export const SelectOption: React.FC<SelectOptionProps> = ({
  id,
  title,
  description,
  icon,
  children,
  isSelected,
  isActive,
  onClick,
  onFocus,
  onKeyDown,
  disabled = false,
  ...props
}) => {
  return (
    <Item
      {...props}
      id={id}
      role="option"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isSelected}
      aria-disabled={disabled ? true : undefined}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {children ?? (
        <>
          {icon && <Icon>{icon}</Icon>}
          <Col>
            <Title>{title}</Title>
            {description && <Description>{description}</Description>}
          </Col>
        </>
      )}
    </Item>
  );
};

SelectOption.displayName = 'SelectOption';
