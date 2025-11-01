import React, { type FC, Fragment, useCallback, useEffect, useMemo } from 'react';

import { Button, Select } from 'storybook/internal/components';

import { GrowIcon, TransferIcon } from '@storybook/icons';

import { type API, useGlobals, useParameter } from 'storybook/manager-api';
import { Global, styled } from 'storybook/theming';

import { PARAM_KEY } from '../constants';
import { MINIMAL_VIEWPORTS } from '../defaults';
import { responsiveViewport } from '../responsiveViewport';
import { registerShortcuts } from '../shortcuts';
import type { GlobalStateUpdate, Viewport, ViewportMap, ViewportParameters } from '../types';
import { ActiveViewportLabel, ActiveViewportSize, iconsMap } from '../utils';

interface PureProps {
  item: Viewport;
  updateGlobals: ReturnType<typeof useGlobals>['1'];
  viewportMap: ViewportMap;
  viewportName: keyof ViewportMap;
  isLocked: boolean;
  isRotated: boolean | undefined;
  width: string;
  height: string;
}

export const ViewportTool: FC<{ api: API }> = ({ api }) => {
  const config = useParameter<ViewportParameters['viewport']>(PARAM_KEY);
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const { options = MINIMAL_VIEWPORTS, disable } = config || {};
  const data = globals?.[PARAM_KEY] || {};
  const viewportName = typeof data === 'string' ? data : data.value;
  const isRotated = typeof data === 'string' ? false : !!data.isRotated;

  const item = (options as ViewportMap)[viewportName] || responsiveViewport;
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
        isLocked,
        width,
        height,
      }}
    />
  );
};

// These ensure that we both present a logical DOM order based on whether
// or not viewport dimensions are locked, and display them with the '/' or
// rotate button in the middle.
const FirstDimension = styled(ActiveViewportLabel)({
  order: 1,
});
const DimensionSeparator = styled.div({
  order: 2,
});
const LastDimension = styled(ActiveViewportLabel)({
  order: 3,
});

const Pure = React.memo(function PureTool(props: PureProps) {
  const { item, viewportMap, viewportName, isRotated, updateGlobals, isLocked, width, height } =
    props;

  const update = useCallback(
    (input: GlobalStateUpdate | undefined) => updateGlobals({ [PARAM_KEY]: input }),
    [updateGlobals]
  );

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
    <Fragment>
      <Select
        resetLabel="Reset viewport"
        onReset={() => update({ value: undefined, isRotated: false })}
        key="viewport"
        disabled={isLocked}
        ariaLabel={isLocked ? 'Viewport size set by story parameters' : 'Viewport size'}
        ariaDescription="Select a viewport size among predefined options for the preview area, or reset to the default size."
        tooltip={isLocked ? 'Viewport size set by story parameters' : 'Resize viewport'}
        defaultOptions={viewportName}
        options={options}
        onSelect={(selected) => update({ value: selected, isRotated: false })}
        icon={<GrowIcon />}
      >
        {item !== responsiveViewport ? (
          <>
            {item.name} {isRotated ? `(L)` : `(P)`}
          </>
        ) : null}
      </Select>

      <Global
        styles={{
          [`iframe[data-is-storybook="true"]`]: { width, height },
        }}
      />

      {item !== responsiveViewport ? (
        <ActiveViewportSize>
          <FirstDimension title="Viewport width">
            <span className="sb-sr-only">Viewport width: </span>
            {width.replace('px', '')}
          </FirstDimension>
          {isLocked && <DimensionSeparator>/</DimensionSeparator>}
          <LastDimension title="Viewport height">
            <span className="sb-sr-only">Viewport height: </span>
            {height.replace('px', '')}
          </LastDimension>
          {!isLocked && (
            <DimensionSeparator>
              <Button
                key="viewport-rotate"
                padding="small"
                variant="ghost"
                ariaLabel="Rotate viewport"
                onClick={() => {
                  update({ value: viewportName, isRotated: !isRotated });
                }}
              >
                <TransferIcon />
              </Button>
            </DimensionSeparator>
          )}
        </ActiveViewportSize>
      ) : null}
    </Fragment>
  );
});
