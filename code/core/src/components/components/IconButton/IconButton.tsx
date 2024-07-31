import React, { forwardRef } from 'react';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ padding = 'small', variant = 'ghost', ...props }, ref) => {
    return <Button padding={padding} variant={variant} ref={ref} {...props} />;
  }
);

IconButton.displayName = 'IconButton';
