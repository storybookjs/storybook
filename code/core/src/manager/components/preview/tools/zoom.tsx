import type { SyntheticEvent, MouseEventHandler, PropsWithChildren } from 'react';
import React, { Component, createContext, memo, useCallback } from 'react';

import { IconButton, Separator } from '@storybook/core/components';
import type { Addon_BaseType } from '@storybook/core/types';
import { types } from '@storybook/core/manager-api';
import { ZoomIcon, ZoomOutIcon, ZoomResetIcon } from '@storybook/icons';

const initialZoom = 1 as const;

const Context = createContext({ value: initialZoom, set: (v: number) => {} });

class ZoomProvider extends Component<
  PropsWithChildren<{ shouldScale: boolean }>,
  { value: number }
> {
  state = {
    value: initialZoom,
  };

  set = (value: number) => this.setState({ value });

  render() {
    const { children, shouldScale } = this.props;
    const { set } = this;
    const { value } = this.state;
    return (
      <Context.Provider value={{ value: shouldScale ? value : initialZoom, set }}>
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

const ZoomWrapper = memo<{ set: (zoomLevel: number) => void; value: number }>(function ZoomWrapper({
  set,
  value,
}) {
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
      set(initialZoom);
    },
    [set, initialZoom]
  );
  return <Zoom key="zoom" {...{ zoomIn, zoomOut, reset }} />;
});

function ZoomToolRenderer() {
  return (
    <>
      <ZoomConsumer>{({ set, value }) => <ZoomWrapper {...{ set, value }} />}</ZoomConsumer>
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
