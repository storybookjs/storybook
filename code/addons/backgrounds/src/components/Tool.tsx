import React, { Fragment, memo, useCallback, useState } from 'react';

import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import { useGlobals, useParameter } from 'storybook/internal/manager-api';

import { CircleIcon, GridIcon, PhotoIcon, RefreshIcon } from '@storybook/icons';

import { PARAM_KEY as KEY } from '../constants';
import { DEFAULT_BACKGROUNDS } from '../defaults';
import type { Background, BackgroundMap, Config, GlobalStateUpdate } from '../types';

type Link = Parameters<typeof TooltipLinkList>['0']['links'][0];

export const BackgroundTool = memo(function BackgroundSelector() {
  const config = useParameter<Config>(KEY);
  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

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
        setIsTooltipVisible,
        isLocked,
        isGridActive,
        isTooltipVisible,
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
  setIsTooltipVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isLocked: boolean;
  isGridActive: boolean;
  isTooltipVisible: boolean;
}

const Pure = memo(function PureTool(props: PureProps) {
  const {
    item,
    length,
    updateGlobals,
    setIsTooltipVisible,
    backgroundMap,
    backgroundName,
    isLocked,
    isGridActive: isGrid,
    isTooltipVisible,
  } = props;

  const update = useCallback(
    (input: GlobalStateUpdate) => {
      updateGlobals({
        [KEY]: input,
      });
    },
    [updateGlobals]
  );

  return (
    <Fragment>
      <IconButton
        key="grid"
        active={isGrid}
        disabled={isLocked}
        title="Apply a grid to the preview"
        onClick={() => update({ value: backgroundName, grid: !isGrid })}
      >
        <GridIcon />
      </IconButton>

      {length > 0 ? (
        <WithTooltip
          key="background"
          placement="top"
          closeOnOutsideClick
          tooltip={({ onHide }) => {
            return (
              <TooltipLinkList
                links={[
                  ...(!!item
                    ? [
                        {
                          id: 'reset',
                          title: 'Reset background',
                          icon: <RefreshIcon />,
                          onClick: () => {
                            update({ value: undefined, grid: isGrid });
                            onHide();
                          },
                        },
                      ]
                    : []),
                  ...Object.entries(backgroundMap).map<Link>(([k, value]) => ({
                    id: k,
                    title: value.name,
                    icon: <CircleIcon color={value?.value || 'grey'} />,
                    active: k === backgroundName,
                    onClick: () => {
                      update({ value: k, grid: isGrid });
                      onHide();
                    },
                  })),
                ].flat()}
              />
            );
          }}
          onVisibleChange={setIsTooltipVisible}
        >
          <IconButton
            disabled={isLocked}
            key="background"
            title="Change the background of the preview"
            active={!!item || isTooltipVisible}
          >
            <PhotoIcon />
          </IconButton>
        </WithTooltip>
      ) : null}
    </Fragment>
  );
});
