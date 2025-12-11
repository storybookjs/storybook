import type { PropsWithChildren } from 'react';
import React, { Component, createContext, memo, useCallback, useEffect, useRef } from 'react';

import { ActionList, Button, PopoverProvider } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { types, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Shortcut } from '../../Shortcut';

const BASE_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const INITIAL_ZOOM_LEVEL = 1;

const ZoomButton = styled(Button)({
  minWidth: 48,
});

const Context = createContext({ value: INITIAL_ZOOM_LEVEL, set: (v: number) => {} });

export const ZoomConsumer = Context.Consumer;

export class ZoomProvider extends Component<
  PropsWithChildren<{ shouldScale: boolean }>,
  { value: number }
> {
  state = {
    value: INITIAL_ZOOM_LEVEL,
  };

  set = (value: number) => this.setState({ value });

  render() {
    const { children, shouldScale } = this.props;
    const { set } = this;
    const { value } = this.state;
    return (
      <Context.Provider value={{ value: shouldScale ? value : INITIAL_ZOOM_LEVEL, set }}>
        {children}
      </Context.Provider>
    );
  }
}

export const Zoom = memo<{
  value: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (value: number) => void;
}>(function Zoom({ value, zoomIn, zoomOut, zoomTo }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <PopoverProvider
      padding="none"
      onVisibleChange={(isVisible) => {
        if (isVisible) {
          requestAnimationFrame(() => inputRef.current?.select());
        }
      }}
      popover={
        <div style={{ minWidth: 200 }}>
          <ActionList>
            <ActionList.Item>
              <ActionList.Action onClick={zoomIn} ariaLabel={false}>
                <ActionList.Text>Zoom in</ActionList.Text>
                <Shortcut keys={['alt', '+']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item>
              <ActionList.Action onClick={zoomOut} ariaLabel={false}>
                <ActionList.Text>Zoom out</ActionList.Text>
                <Shortcut keys={['alt', '-']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item>
              <ActionList.Action onClick={() => zoomTo(0.5)} ariaLabel={false}>
                <ActionList.Text>Zoom to 50%</ActionList.Text>
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item>
              <ActionList.Action onClick={() => zoomTo(1)} ariaLabel={false}>
                <ActionList.Text>Reset to 100%</ActionList.Text>
                <Shortcut keys={['alt', '0']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item>
              <ActionList.Action onClick={() => zoomTo(2)} ariaLabel={false}>
                Zoom to 200%
              </ActionList.Action>
            </ActionList.Item>
          </ActionList>
        </div>
      }
    >
      <ZoomButton padding="small" variant="ghost" ariaLabel="Change zoom level">
        {Math.round(value * 100)}%
      </ZoomButton>
    </PopoverProvider>
  );
});

const ZoomWrapper = memo<{
  set: (zoomLevel: number) => void;
  value: number;
}>(function ZoomWrapper({ set, value }) {
  const api = useStorybookApi();

  const zoomIn = useCallback(() => {
    const higherZoomLevel = BASE_ZOOM_LEVELS.find((level) => level > value);
    if (higherZoomLevel) {
      set(higherZoomLevel);
    }
  }, [set, value]);

  const zoomOut = useCallback(() => {
    const lowerZoomLevel = BASE_ZOOM_LEVELS.findLast((level) => level < value);
    if (lowerZoomLevel) {
      set(lowerZoomLevel);
    }
  }, [set, value]);

  const zoomTo = useCallback(
    (value: number) => {
      set(value);
    },
    [set]
  );

  useEffect(() => {
    api.setAddonShortcut('zoom', {
      label: 'Zoom to 100%',
      defaultShortcut: ['alt', '0'],
      actionName: 'zoomReset',
      action: () => zoomTo(1),
    });
    api.setAddonShortcut('zoom', {
      label: 'Zoom in',
      defaultShortcut: ['alt', '='],
      actionName: 'zoomIn',
      action: zoomIn,
    });
    api.setAddonShortcut('zoom', {
      label: 'Zoom out',
      defaultShortcut: ['alt', '-'],
      actionName: 'zoomOut',
      action: zoomOut,
    });
  }, [api, zoomIn, zoomOut, zoomTo]);

  return <Zoom key="zoom" {...{ value, zoomIn, zoomOut, zoomTo }} />;
});

export const zoomTool: Addon_BaseType = {
  title: 'zoom',
  id: 'zoom',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => <ZoomConsumer>{(zoomContext) => <ZoomWrapper {...zoomContext} />}</ZoomConsumer>,
};
