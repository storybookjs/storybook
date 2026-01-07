import React from 'react';

import { darken, transparentize } from 'polished';
import { styled } from 'storybook/theming';

import { ActionList } from '../..';

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

  /** Right-aligned content. */
  right?: React.ReactNode;

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

export const SelectOption: React.FC<SelectOptionProps> = ({
  id,
  title,
  description,
  icon,
  right,
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
    <ActionList.Item
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
      <ActionList.Action>
        {children ?? (
          <>
            {icon && <ActionList.Icon>{icon}</ActionList.Icon>}
            <ActionList.Text>
              <p>{title}</p>
              {description && <small>{description}</small>}
            </ActionList.Text>
            {right}
          </>
        )}
      </ActionList.Action>
    </ActionList.Item>
  );
};

SelectOption.displayName = 'SelectOption';
