import React, { useMemo } from 'react';

import { Select } from 'storybook/internal/components';

import { GrowIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { useViewport } from '../useViewport.ts';
import { iconsMap } from '../viewportIcons.tsx';

const Dimensions = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 2,
  marginLeft: 20,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1 - 1,
  fontWeight: theme.typography.weight.regular,
  color: theme.textMutedColor,
}));

export const ViewportTool = () => {
  const { name, value, isDefault, isLocked, options: viewportMap, reset, select, isCustom } = useViewport();

  const options = useMemo(
    () =>
      Object.entries(viewportMap).map(([k, value]) => ({
        value: k,
        title: value.name,
        icon: iconsMap[value.type!],
        right: (
          <Dimensions>
            <span>{value.styles.width.replace('px', '')}</span>
            <span>&times;</span>
            <span>{value.styles.height.replace('px', '')}</span>
          </Dimensions>
        ),
      })),
    [viewportMap]
  );

  return (
    <Select
      resetLabel="Reset viewport"
      onReset={reset}
      key="viewport"
      disabled={isLocked}
      ariaLabel={isLocked ? 'Viewport size set by story parameters' : 'Viewport size'}
      ariaDescription="Select a viewport among predefined options for the preview area, or reset to the default viewport."
      tooltip={isLocked ? 'Viewport set by story parameters' : 'Change viewport'}
      defaultOptions={isCustom ? undefined : value}
      options={options}
      onSelect={(selected) => select(selected as string)}
      icon={<GrowIcon />}
      active={!isDefault}
    >
      {isDefault ? null : name}
    </Select>
  );
};
