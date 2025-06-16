import React, { forwardRef } from 'react';

import type { ToggleButtonProps } from '../ToggleButton/ToggleButton';
import { ToggleButton } from '../ToggleButton/ToggleButton';

export interface ToggleIconButtonProps extends ToggleButtonProps {
  /** The aria-label for the ToggleIconButton. Must describe what happens when the button is pressed. */
  ariaLabel: string;
}

export const ToggleIconButton = forwardRef<HTMLButtonElement, ToggleIconButtonProps>(
  ({ padding = 'small', variant = 'ghost', ariaLabel, tooltip, ...props }, ref) => {
    return (
      <ToggleButton
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

ToggleIconButton.displayName = 'ToggleIconButton';
