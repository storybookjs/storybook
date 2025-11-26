import React, { forwardRef } from 'react';

import { Popover, type PopoverProps } from '../Popover/Popover';

export type TooltipProps = Omit<PopoverProps, 'onHide' | 'hideLabel'>;

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>((props, ref) => {
  return <Popover ref={ref} {...props} />;
});

Tooltip.displayName = 'Tooltip';
