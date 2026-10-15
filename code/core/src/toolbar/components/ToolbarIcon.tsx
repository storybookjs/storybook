import * as Icons from '@storybook/icons';

import type { FC } from 'react';

import type { ToolbarIconType } from '../types.ts';

interface ToolbarIconProps {
  icon?: ToolbarIconType;
}

/**
 * Resolves an `@storybook/icons` export name to its component, for icon names serialized from
 * preview configs. Returns null for missing or unknown names, so a config carrying a legacy or
 * misspelled name renders no icon instead of crashing.
 */
export const ToolbarIcon: FC<ToolbarIconProps> = ({ icon }) => {
  if (!icon) {
    return null;
  }
  // `icon` is typed as the union of `*Icon` export names, so this lookup yields exactly the
  // components behind those names; a runtime value outside the union resolves to undefined.
  const Resolved = Icons[icon];
  return Resolved ? <Resolved /> : null;
};
