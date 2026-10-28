import React from 'react';

import { BrowserIcon, DiamondIcon, MobileIcon, TabletIcon, WatchIcon } from '@storybook/icons';

import type { Viewport } from '@storybook/core/internal/deep/shared/viewport/types';

export const iconsMap: Record<NonNullable<Viewport['type']>, React.ReactNode> = {
  desktop: <BrowserIcon />,
  mobile: <MobileIcon />,
  tablet: <TabletIcon />,
  watch: <WatchIcon />,
  other: <DiamondIcon />,
};
