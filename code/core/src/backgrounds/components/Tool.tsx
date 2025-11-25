import React, { Fragment, memo, useCallback } from 'react';

import { Select, ToggleButton } from 'storybook/internal/components';

import { CircleIcon, GridIcon, PhotoIcon } from '@storybook/icons';

import { useGlobals, useParameter } from 'storybook/manager-api';

import { PARAM_KEY as KEY } from '../constants';
import { DEFAULT_BACKGROUNDS } from '../defaults';
import type { Background, BackgroundMap, BackgroundsParameters, GlobalStateUpdate } from '../types';

export const BackgroundTool = memo(function BackgroundSelector() {
  const config = useParameter<BackgroundsParameters['backgrounds']>(KEY);
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const { options = DEFAULT_BACKGROUNDS, disable = true } = config || {};
  if (disable) {
    return null;
  }

  const data = globals[KEY] || {};
  const backgroundName: string = data.value;
  const isGridActive = data.grid || false;

  const item = options[backgroundName];
  const isLocked = !!storyGlobals?.[KEY];
  const length = Object.keys(options).length;

  return (
    <Pure
      {...{
        length,
        backgroundMap: options,
        item,
        updateGlobals,
        backgroundName,
        isLocked,
        isGridActive,
      }}
    />
  );
});

interface PureProps {
  length: number;
  backgroundMap: BackgroundMap;
  item: Background | undefined;
  updateGlobals: ReturnType<typeof useGlobals>['1'];
  backgroundName: string | undefined;
  isLocked: boolean;
  isGridActive: boolean;
}

const Pure = memo(function PureTool(props: PureProps) {
  const {
    item,
    length,
    updateGlobals,
    backgroundMap,
    backgroundName,
    isLocked,
    isGridActive: isGrid,
  } = props;

  const update = useCallback(
    (input: GlobalStateUpdate | undefined) => {
      updateGlobals({
        [KEY]: input,
      });
    },
    [updateGlobals]
  );

  const options = Object.entries(backgroundMap).map(([k, value]) => ({
    value: k,
    title: value.name,
    icon: <CircleIcon color={value?.value || 'grey'} />,
  }));

  return (
    <Fragment>
      <ToggleButton
        padding="small"
        variant="ghost"
        key="grid"
        pressed={isGrid}
        disabled={isLocked}
        ariaLabel={isLocked ? 'Grid set by story parameters' : 'Grid visibility'}
        tooltip={isLocked ? 'Grid set by story parameters' : 'Toggle grid visibility'}
        onClick={() => update({ value: backgroundName, grid: !isGrid })}
      >
        <GridIcon />
      </ToggleButton>

      {length > 0 ? (
        <Select
          resetLabel="Reset background"
          onReset={() => update(undefined)}
          disabled={isLocked}
          key="background"
          icon={<PhotoIcon />}
          ariaLabel={isLocked ? 'Background set by story parameters' : 'Preview background'}
          tooltip={isLocked ? 'Background set by story parameters' : 'Change background'}
          defaultOptions={backgroundName}
          options={options}
          onSelect={(selected) => update({ value: selected, grid: isGrid })}
        />
      ) : null}
    </Fragment>
  );
});
