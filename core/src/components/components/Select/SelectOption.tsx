import React from 'react';

import { darken, transparentize } from 'polished';
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
  shouldLookDisabled: boolean;
}

const Item = styled('li')(({ theme }) => ({
  padding: '6px 12px',
  fontSize: 12,
  lineHeight: 1.5,
  background: 'transparent',
  color: theme.color.defaultText,
  cursor: 'pointer',
  borderRadius: 4,
  '&[aria-disabled="true"]': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  '&[aria-selected="true"]': {
    color: theme.base === 'light' ? darken(0.1, theme.color.secondary) : theme.color.secondary,
    fontWeight: theme.typography.weight.bold,
  },
  ':hover': {
    background: transparentize(0.93, theme.color.secondary),
  },
  ':focus-visible': {
    background: theme.background.hoverable,
    outline: `2px solid ${theme.barSelectedColor}`,
    outlineOffset: 1,
    borderRadius: 2,
  },
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
}));

const Row = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  gap: 4,
  alignItems: 'center',
});

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

const Title = styled('span')(({}) => ({}));

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
  shouldLookDisabled = false,
  ...props
}) => {
  return (
    <Item
      {...props}
      id={id}
      role="option"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isSelected}
      aria-disabled={shouldLookDisabled ? true : undefined}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    >
      {children ?? (
        <Row>
          {icon && <Icon>{icon}</Icon>}
          <Col>
            <Title>{title}</Title>
            {description && <Description>{description}</Description>}
          </Col>
        </Row>
      )}
    </Item>
  );
};

SelectOption.displayName = 'SelectOption';
