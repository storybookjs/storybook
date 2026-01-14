import React from 'react';

import { BrowserIcon, DiamondIcon, MobileIcon, TabletIcon, WatchIcon } from '@storybook/icons';

import type { Viewport } from './types';

export const iconsMap: Record<NonNullable<Viewport['type']>, React.ReactNode> = {
  desktop: <BrowserIcon />,
  mobile: <MobileIcon />,
  tablet: <TabletIcon />,
  watch: <WatchIcon />,
  other: <DiamondIcon />,
};
