import React, { useMemo } from 'react';

import { Select } from 'storybook/internal/components';

import { GrowIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { useViewport } from '../useViewport';
import { iconsMap } from '../viewportIcons';

const Dimensions = styled.div({
  display: 'flex',
  gap: 2,
  marginLeft: 20,
  fontFamily: 'var(--sb-typography-fonts-mono)',
  fontSize: `calc(var(--sb-typography-size-s1) - 1px)`,
  fontWeight: 'var(--sb-typography-weight-regular)',
  color: 'var(--sb-textMutedColor)',
});

export const ViewportTool = () => {
  const { name, value, isDefault, isLocked, options: viewportMap, reset, select } = useViewport();

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
      defaultOptions={value}
      options={options}
      onSelect={(selected) => select(selected as string)}
      icon={<GrowIcon />}
    >
      {isDefault ? null : name}
    </Select>
  );
};
