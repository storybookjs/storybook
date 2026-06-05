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
  const { name, value, isDefault, isCustom, isLocked, options: viewportMap, reset, select } =
    useViewport();

  const options = useMemo(() => {
    const presetOptions = Object.entries(viewportMap).map(([k, value]) => ({
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
    }));

    // When a custom viewport is active (user has manually set width/height), inject
    // a synthetic option matching the current value. This ensures the Select component
    // detects a selection and renders the toolbar button in its active (highlighted) state.
    // Without this, isCustom viewports match no preset key and $hasSelection stays false.
    if (isCustom && value) {
      return [
        ...presetOptions,
        {
          value,
          title: name,
          icon: iconsMap['other'],
          right: null,
        },
      ];
    }

    return presetOptions;
  }, [viewportMap, isCustom, value, name]);

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
