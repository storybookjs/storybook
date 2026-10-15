import * as Icons from '@storybook/icons';

import type { FC } from 'react';
import React from 'react';

import { once } from 'storybook/internal/client-logger';

import type { ToolbarIconType } from '../types.ts';

interface ToolbarIconProps {
  icon?: ToolbarIconType;
}

// Icon names arrive from preview configs over the channel as plain strings, so at runtime they are
// not limited to the ToolbarIconType union: any key of the icons namespace could arrive, including
// non-component exports such as `iconList` that would throw when rendered as a component.
const isIconComponent = (name: string): name is ToolbarIconType =>
  name.endsWith('Icon') && Object.hasOwn(Icons, name);

/**
 * Resolves an `@storybook/icons` export name to its component, for icon names serialized from
 * preview configs. Renders nothing for missing or unknown names, so a config carrying a legacy or
 * misspelled name renders no icon instead of crashing; an unknown name warns once, replacing the
 * warning the removed `Icons` component used to emit.
 */
export const ToolbarIcon: FC<ToolbarIconProps> = ({ icon }) => {
  if (!icon) {
    return null;
  }
  if (!isIconComponent(icon)) {
    once.warn(`Toolbar icon '${icon}' is not an @storybook/icons export; rendering no icon.`);
    return null;
  }
  const Resolved = Icons[icon];
  return <Resolved />;
};
