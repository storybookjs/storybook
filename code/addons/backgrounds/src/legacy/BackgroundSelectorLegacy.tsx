import type { FC, ReactElement } from 'react';
import React, { memo, useCallback, useMemo, useState } from 'react';

import { logger } from 'storybook/internal/client-logger';
import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import { useGlobals, useParameter } from 'storybook/internal/manager-api';

import { PhotoIcon } from '@storybook/icons';

import memoize from 'memoizerific';

import { PARAM_KEY as BACKGROUNDS_PARAM_KEY } from '../constants';
import type { Background } from '../types';
import { ColorIcon } from './ColorIcon';
import { getBackgroundColorByName } from './getBackgroundColorByName';

export interface DeprecatedGlobalState {
  name: string | undefined;
  selected: string | undefined;
}

export interface BackgroundsParameter {
  default?: string | null;
  disable?: boolean;
  values: Background[];
}

export interface BackgroundSelectorItem {
  id: string;
  title: string;
  onClick: () => void;
  value: string;
  active: boolean;
  right?: ReactElement;
}

const createBackgroundSelectorItem = memoize(1000)(
  (
    id: string | null,
    name: string,
    value: string,
    hasSwatch: boolean | null,
    change: (arg: { selected: string; name: string }) => void,
    active: boolean
  ): BackgroundSelectorItem => ({
    id: id || name,
    title: name,
    onClick: () => {
      change({ selected: value, name });
    },
    value,
    right: hasSwatch ? <ColorIcon background={value} /> : undefined,
    active,
  })
);

const getDisplayedItems = memoize(10)((
  backgrounds: Background[],
  selectedBackgroundColor: string | null,
  change: (arg: { selected: string; name: string }) => void
) => {
  const backgroundSelectorItems = backgrounds.map(({ name, value }) =>
    createBackgroundSelectorItem(null, name, value, true, change, value === selectedBackgroundColor)
  );

  if (selectedBackgroundColor !== 'transparent') {
    return [
      createBackgroundSelectorItem('reset', 'Clear background', 'transparent', null, change, false),
      ...backgroundSelectorItems,
    ];
  }

  return backgroundSelectorItems;
});

const DEFAULT_BACKGROUNDS_CONFIG: BackgroundsParameter = {
  default: null,
  disable: true,
  values: [],
};

export const BackgroundToolLegacy: FC = memo(function BackgroundSelector() {
  const backgroundsConfig = useParameter<BackgroundsParameter>(
    BACKGROUNDS_PARAM_KEY,
    DEFAULT_BACKGROUNDS_CONFIG
  );
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [globals, updateGlobals] = useGlobals();

  const globalsBackgroundColor = globals[BACKGROUNDS_PARAM_KEY]?.value;

  const selectedBackgroundColor = useMemo(() => {
    return getBackgroundColorByName(
      globalsBackgroundColor,
      backgroundsConfig.values,
      backgroundsConfig.default
    );
  }, [backgroundsConfig, globalsBackgroundColor]);

  if (Array.isArray(backgroundsConfig)) {
    logger.warn(
      'Addon Backgrounds api has changed in Storybook 6.0. Please refer to the migration guide: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md'
    );
  }

  const onBackgroundChange = useCallback(
    (value: string | undefined) => {
      updateGlobals({ [BACKGROUNDS_PARAM_KEY]: { ...globals[BACKGROUNDS_PARAM_KEY], value } });
    },
    [backgroundsConfig, globals, updateGlobals]
  );

  if (backgroundsConfig.disable) {
    return null;
  }

  return (
    <WithTooltip
      placement="top"
      closeOnOutsideClick
      tooltip={({ onHide }) => {
        return (
          <TooltipLinkList
            links={getDisplayedItems(
              backgroundsConfig.values,
              selectedBackgroundColor,
              ({ selected }: DeprecatedGlobalState) => {
                if (selectedBackgroundColor !== selected) {
                  onBackgroundChange(selected);
                }
                onHide();
              }
            )}
          />
        );
      }}
      onVisibleChange={setIsTooltipVisible}
    >
      <IconButton
        key="background"
        title="Change the background of the preview"
        active={selectedBackgroundColor !== 'transparent' || isTooltipVisible}
      >
        <PhotoIcon />
      </IconButton>
    </WithTooltip>
  );
});
