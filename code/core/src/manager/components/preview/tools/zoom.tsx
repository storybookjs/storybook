import type { EventHandler, PropsWithChildren, SyntheticEvent } from 'react';
import React, { Component, createContext, memo, useCallback } from 'react';

import { IconButton, Separator } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { ZoomIcon, ZoomOutIcon, ZoomResetIcon } from '@storybook/icons';

import { types } from 'storybook/manager-api';

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
  zoomIn: EventHandler<SyntheticEvent>;
  zoomOut: EventHandler<SyntheticEvent>;
  reset: EventHandler<SyntheticEvent>;
}>(function Zoom({ zoomIn, zoomOut, reset }) {
  return (
    <>
      <IconButton key="zoomin" onClick={zoomIn} label="Zoom in">
        <ZoomIcon />
      </IconButton>
      <IconButton key="zoomout" onClick={zoomOut} label="Zoom out">
        <ZoomOutIcon />
      </IconButton>
      <IconButton key="zoomreset" onClick={reset} label="Reset zoom">
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
