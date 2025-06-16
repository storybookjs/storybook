import React, { forwardRef } from 'react';

import { logger } from 'storybook/internal/client-logger';

import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';

export interface IconButtonProps extends ButtonProps {
  /** The aria-label for the IconButton. Will be mandatory in Storybook 10. */
  ariaLabel?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ padding = 'small', variant = 'ghost', ariaLabel, tooltip, ...props }, ref) => {
    if (!ariaLabel) {
      logger.warn(
        `IconButton requires an aria-label to be accessible (title: ${props.title || ' ø'}; tooltip: ${tooltip || ' ø'}).`
      );
    }

    return (
      <Button
        padding={padding}
        variant={variant}
        ref={ref}
        ariaLabel={ariaLabel}
        tooltip={tooltip || ariaLabel}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';
