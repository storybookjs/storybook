import type { FC, ReactNode } from 'react';
import React from 'react';

import { Button } from 'storybook/internal/components';

/**
 * Adds `control` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes
 *
 * @example
 *
 * ```ts
 * getControlId('my prop name') -> 'control-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlId = (value: string, storyId?: string) => {
  const base = value.replace(/\s+/g, '-');
  return storyId ? `control-${storyId}-${base}` : `control-${base}`;
};

/**
 * Adds `set` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes
 *
 * @example
 *
 * ```ts
 * getControlSetterButtonId('my prop name') -> 'set-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlSetterButtonId = (value: string, storyId?: string) => {
  const base = value.replace(/\s+/g, '-');
  return storyId ? `set-${storyId}-${base}` : `set-${base}`;
};

interface SetValueButtonProps {
  name: string;
  storyId?: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export const SetValueButton: FC<SetValueButtonProps> = ({
  name,
  storyId,
  children,
  onClick,
  disabled,
}) => (
  <Button
    ariaLabel={false}
    variant="outline"
    size="medium"
    id={getControlSetterButtonId(name, storyId)}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);
