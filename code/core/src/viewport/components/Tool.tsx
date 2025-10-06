import React, { type FC, Fragment, useCallback, useEffect, useState } from 'react';

import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';

import { GrowIcon, RefreshIcon, TransferIcon } from '@storybook/icons';

import { type API, useGlobals, useParameter } from 'storybook/manager-api';
import { Global } from 'storybook/theming';

import { PARAM_KEY } from '../constants';
import { MINIMAL_VIEWPORTS } from '../defaults';
import { responsiveViewport } from '../responsiveViewport';
import { registerShortcuts } from '../shortcuts';
import type { GlobalStateUpdate, Viewport, ViewportMap, ViewportParameters } from '../types';
import {
  ActiveViewportLabel,
  ActiveViewportSize,
  IconButtonLabel,
  IconButtonWithLabel,
  iconsMap,
} from '../utils';

interface PureProps {
  item: Viewport;
  updateGlobals: ReturnType<typeof useGlobals>['1'];
  setIsTooltipVisible: React.Dispatch<React.SetStateAction<boolean>>;
  viewportMap: ViewportMap;
  viewportName: keyof ViewportMap;
  isLocked: boolean;
  isActive: boolean;
  isRotated: boolean | undefined;
  width: string;
  height: string;
}

type Link = Parameters<typeof TooltipLinkList>['0']['links'][0];

export const ViewportTool: FC<{ api: API }> = ({ api }) => {
  const config = useParameter<ViewportParameters['viewport']>(PARAM_KEY);
  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const { options = MINIMAL_VIEWPORTS, disable } = config || {};
  const data = globals?.[PARAM_KEY] || {};
  const viewportName = typeof data === 'string' ? data : data.value;
  const isRotated = typeof data === 'string' ? false : !!data.isRotated;

  const item = (options as ViewportMap)[viewportName] || responsiveViewport;
  const isActive = isTooltipVisible || item !== responsiveViewport;
  const isLocked = PARAM_KEY in storyGlobals;

  const length = Object.keys(options).length;

  useEffect(() => {
    registerShortcuts(api, viewportName, updateGlobals, Object.keys(options));
  }, [options, viewportName, updateGlobals, api]);

  if (item.styles === null || !options || length < 1) {
    return null;
  }

  if (typeof item.styles === 'function') {
    console.warn(
      'Addon Viewport no longer supports dynamic styles using a function, use css calc() instead'
    );
    return null;
  }

  const width = isRotated ? item.styles.height : item.styles.width;
  const height = isRotated ? item.styles.width : item.styles.height;

  if (disable) {
    return null;
  }

  return (
    <Pure
      {...{
        item,
        updateGlobals,
        viewportMap: options,
        viewportName,
        isRotated,
        setIsTooltipVisible,
        isLocked,
        isActive,
        width,
        height,
      }}
    />
  );
};

const Pure = React.memo(function PureTool(props: PureProps) {
  const {
    item,
    viewportMap,
    viewportName,
    isRotated,
    updateGlobals,
    setIsTooltipVisible,
    isLocked,
    isActive,
    width,
    height,
  } = props;

  const update = useCallback(
    (input: GlobalStateUpdate | undefined) => updateGlobals({ [PARAM_KEY]: input }),
    [updateGlobals]
  );

  return (
    <Fragment>
      <WithTooltip
        placement="bottom"
        tooltip={({ onHide }) => (
          <TooltipLinkList
            links={[
              ...(length > 0 && item !== responsiveViewport
                ? [
                    {
                      id: 'reset',
                      title: 'Reset viewport',
                      icon: <RefreshIcon />,
                      onClick: () => {
                        update(undefined);
                        onHide();
                      },
                    },
                  ]
                : []),
              ...Object.entries(viewportMap).map<Link>(([k, value]) => ({
                id: k,
                title: value.name,
                icon: iconsMap[value.type!],
                active: k === viewportName,
                onClick: () => {
                  update({ value: k, isRotated: false });
                  onHide();
                },
              })),
            ].flat()}
          />
        )}
        closeOnOutsideClick
        onVisibleChange={setIsTooltipVisible}
      >
        <IconButtonWithLabel
          disabled={isLocked}
          key="viewport"
          title="Change the size of the preview"
          active={isActive}
          onDoubleClick={() => {
            update({ value: undefined, isRotated: false });
          }}
        >
          <GrowIcon />
          {item !== responsiveViewport ? (
            <IconButtonLabel>
              {item.name} {isRotated ? `(L)` : `(P)`}
            </IconButtonLabel>
          ) : null}
        </IconButtonWithLabel>
      </WithTooltip>

      <Global
        styles={{
          [`iframe[data-is-storybook="true"]`]: { width, height },
        }}
      />

      {item !== responsiveViewport ? (
        <ActiveViewportSize>
          <ActiveViewportLabel title="Viewport width">
            {width.replace('px', '')}
          </ActiveViewportLabel>
          {!isLocked ? (
            <IconButton
              key="viewport-rotate"
              title="Rotate viewport"
              onClick={() => {
                update({ value: viewportName, isRotated: !isRotated });
              }}
            >
              <TransferIcon />
            </IconButton>
          ) : (
            '/'
          )}
          <ActiveViewportLabel title="Viewport height">
            {height.replace('px', '')}
          </ActiveViewportLabel>
        </ActiveViewportSize>
      ) : null}
    </Fragment>
  );
});
