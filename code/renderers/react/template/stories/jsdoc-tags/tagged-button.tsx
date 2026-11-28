import React from 'react';

export interface TaggedButtonProps {
  /**
   * The button text.
   *
   * @deprecated Use `children` instead.
   */
  label?: string;
  /** The button content. */
  children?: React.ReactNode;
  /**
   * The button size.
   *
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * A prop that docgen should hide.
   *
   * @ignore
   */
  internalId?: string;
  /**
   * Called when the button is clicked.
   *
   * @param event The click event.
   * @returns Nothing.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * The button style.
   *
   * @example <TaggedButton variant="primary" />
   * @since 1.0.0
   */
  variant?: 'primary' | 'secondary';
}

/**
 * Component docblock description.
 *
 * @summary Component summary
 * @describe Component describe text
 * @import import { TaggedButton } from '@example/tagged-button';
 * @deprecated Component deprecated note
 * @example <TaggedButton label="Component example" />
 * @since 1.0.0
 */
export const TaggedButton = ({ label, children, size = 'medium', onClick }: TaggedButtonProps) => (
  <button type="button" data-size={size} onClick={onClick}>
    {children ?? label}
  </button>
);
