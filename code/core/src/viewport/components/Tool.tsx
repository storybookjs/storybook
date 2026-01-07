import React, { useMemo } from 'react';

import { Select } from 'storybook/internal/components';

import { GrowIcon } from '@storybook/icons';

import { useViewport } from '../useViewport';
import { iconsMap } from '../viewportIcons';

export const ViewportTool = () => {
  const { name, value, isDefault, isLocked, options: viewportMap, reset, select } = useViewport();

  const options = useMemo(
    () =>
      Object.entries(viewportMap).map(([k, value]) => ({
        value: k,
        title: value.name,
        icon: iconsMap[value.type!],
      })),
    [viewportMap]
  );

  return (
    <Select
      resetLabel="Reset viewport"
      onReset={reset}
      key="viewport"
      disabled={isLocked}
      ariaLabel={isLocked ? 'Viewport set by story parameters' : 'Viewport'}
      ariaDescription="Select a viewport among predefined options for the preview area, or reset to the default viewport."
      tooltip={isLocked ? 'Viewport set by story parameters' : 'Change viewport'}
      defaultOptions={value}
      options={options}
      onSelect={(selected) => select(selected as string)}
      icon={<GrowIcon />}
    >
      {isDefault ? null : name}
    </Select>
  );
};
