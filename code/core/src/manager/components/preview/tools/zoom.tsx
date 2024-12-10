import type { MouseEventHandler, PropsWithChildren, SyntheticEvent } from 'react';
import React, { Component, createContext, memo, useCallback, useEffect } from 'react';

import { IconButton, Separator } from '@storybook/core/components';
import type { Addon_BaseType } from '@storybook/core/types';
import { ZoomIcon, ZoomOutIcon, ZoomResetIcon } from '@storybook/icons';

import { types, useParameter } from '@storybook/core/manager-api';

const DEFAULT_ZOOM = 1 as const;

const Context = createContext({ value: DEFAULT_ZOOM, set: (v: number) => {} });

class ZoomProvider extends Component<
  PropsWithChildren<{ shouldScale: boolean; initialZoom?: any }>,
  { value: number }
> {
  state = {
    value: DEFAULT_ZOOM,
  };

  set = (value: number) => this.setState({ value });

  render() {
    const { children, shouldScale, initialZoom } = this.props;
    const { set } = this;
    const { value } = this.state;
    return (
      <Context.Provider
        value={{ value: initialZoom ? initialZoom : shouldScale ? value : DEFAULT_ZOOM, set }}
      >
        {children}
      </Context.Provider>
    );
  }
}

const { Consumer: ZoomConsumer } = Context;

const Zoom = memo<{
  zoomIn: MouseEventHandler;
  zoomOut: MouseEventHandler;
  reset: MouseEventHandler;
}>(function Zoom({ zoomIn, zoomOut, reset }) {
  return (
    <>
      {/* @ts-expect-error (non strict) */}
      <IconButton key="zoomin" onClick={zoomIn} title="Zoom in">
        <ZoomIcon />
      </IconButton>
      {/* @ts-expect-error (non strict) */}
      <IconButton key="zoomout" onClick={zoomOut} title="Zoom out">
        <ZoomOutIcon />
      </IconButton>
      {/* @ts-expect-error (non strict) */}
      <IconButton key="zoomreset" onClick={reset} title="Reset zoom">
        <ZoomResetIcon />
      </IconButton>
    </>
  );
});

export { Zoom, ZoomConsumer, ZoomProvider };

const ZoomWrapper = memo<{ set: (zoomLevel: number) => void; value: number; initialZoom: number }>(
  function ZoomWrapper({ set, value, initialZoom }) {
    const zoomIn = useCallback(
      (e: SyntheticEvent) => {
        e.preventDefault();
        set(0.8 * value);
      },
      [set, value]
    );
    const zoomOut = useCallback(
      (e: SyntheticEvent) => {
        e.preventDefault();
        set(1.25 * value);
      },
      [set, value]
    );
    const reset = useCallback(
      (e: SyntheticEvent) => {
        e.preventDefault();
        set(DEFAULT_ZOOM);
      },
      [set]
    );
    useEffect(() => {
      if (initialZoom !== DEFAULT_ZOOM) {
        set(100 / initialZoom);
      }
    }, [set, initialZoom]);
    return <Zoom key="zoom" {...{ zoomIn, zoomOut, reset }} />;
  }
);

function ZoomToolRenderer() {
  const initialZoom = useParameter<number>('initialZoom', DEFAULT_ZOOM);
  return (
    <>
      <ZoomConsumer>
        {({ set, value }) => <ZoomWrapper {...{ set, value, initialZoom }} />}
      </ZoomConsumer>
      <Separator />
    </>
  );
}

export const zoomTool: Addon_BaseType = {
  title: 'zoom',
  id: 'zoom',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: ZoomToolRenderer,
};
