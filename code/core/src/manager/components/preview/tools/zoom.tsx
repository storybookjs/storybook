import type { PropsWithChildren } from 'react';
import React, { Component, createContext, memo, useCallback, useEffect, useRef } from 'react';

import { ActionList, Button, PopoverProvider } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { UndoIcon, ZoomIcon } from '@storybook/icons';

import { types, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { Shortcut } from '../../Shortcut';
import { NumericInput } from '../NumericInput';

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 3, 4, 8] as const;
const INITIAL_ZOOM_LEVEL = 1;

const ZoomButton = styled(Button)({
  minWidth: 48,
});

const Context = createContext({ value: INITIAL_ZOOM_LEVEL, set: (v: number) => {} });

const ZoomInput = styled(NumericInput)({
  input: {
    width: 100,
  },
});

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
  zoomBy: (delta: number) => void;
}>(function Zoom({ value, zoomIn, zoomOut, zoomTo, zoomBy }) {
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
        <>
          <ActionList>
            <ActionList.Item>
              <ZoomInput
                aria-label="Zoom percentage"
                ref={inputRef}
                unit="%"
                before={
                  <ActionList.Button size="small" padding="small" readOnly aria-hidden>
                    <ZoomIcon />
                  </ActionList.Button>
                }
                after={
                  <ActionList.Button
                    size="small"
                    padding="small"
                    disabled={value === INITIAL_ZOOM_LEVEL}
                    onClick={() => zoomTo(INITIAL_ZOOM_LEVEL)}
                    ariaLabel="Reset zoom"
                  >
                    <UndoIcon />
                  </ActionList.Button>
                }
                value={`${Math.round(value * 100)}%`}
                minValue={1}
                maxValue={800}
                setValue={(value: string) => {
                  const zoomLevel = parseInt(value, 10) / 100;
                  if (!Number.isNaN(zoomLevel)) {
                    zoomTo(zoomLevel);
                  }
                }}
              />
            </ActionList.Item>
          </ActionList>
          <ActionList>
            <ActionList.Item>
              <ActionList.Action
                onClick={zoomIn}
                ariaLabel="Zoom in"
                disabled={value >= ZOOM_LEVELS.at(-1)!}
              >
                <ActionList.Text>Zoom in</ActionList.Text>
                <Shortcut keys={['alt', '+']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item>
              <ActionList.Action
                onClick={zoomOut}
                ariaLabel="Zoom out"
                disabled={value <= ZOOM_LEVELS.at(0)!}
              >
                <ActionList.Text>Zoom out</ActionList.Text>
                <Shortcut keys={['alt', '-']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item active={value === 0.5}>
              <ActionList.Action onClick={() => zoomTo(0.5)} ariaLabel="Zoom to 50%">
                <ActionList.Text>50%</ActionList.Text>
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item active={value === 1}>
              <ActionList.Action onClick={() => zoomTo(1)} ariaLabel="Zoom to 100%">
                <ActionList.Text>100%</ActionList.Text>
                <Shortcut keys={['alt', '0']} />
              </ActionList.Action>
            </ActionList.Item>
            <ActionList.Item active={value === 2}>
              <ActionList.Action onClick={() => zoomTo(2)} ariaLabel="Zoom to 200%">
                200%
              </ActionList.Action>
            </ActionList.Item>
          </ActionList>
        </>
      }
    >
      <ZoomButton
        padding="small"
        variant="ghost"
        ariaLabel="Change zoom level"
        active={value !== INITIAL_ZOOM_LEVEL}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            zoomBy(-0.01);
            e.preventDefault();
          } else if (e.key === 'ArrowUp') {
            zoomBy(0.01);
            e.preventDefault();
          } else if (e.key === 'PageDown') {
            zoomOut();
            e.preventDefault();
          } else if (e.key === 'PageUp') {
            zoomIn();
            e.preventDefault();
          } else if (e.key === 'Home') {
            zoomTo(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
            e.preventDefault();
          } else if (e.key === 'End') {
            zoomTo(ZOOM_LEVELS[0]);
            e.preventDefault();
          }
        }}
        onWheel={(e) => {
          if (e.deltaY < 0) {
            zoomIn();
          } else if (e.deltaY > 0) {
            zoomOut();
          }
          e.preventDefault();
        }}
      >
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
    const higherZoomLevel = ZOOM_LEVELS.find((level) => level > value);
    if (higherZoomLevel) {
      set(higherZoomLevel);
    }
  }, [set, value]);

  const zoomOut = useCallback(() => {
    const lowerZoomLevel = ZOOM_LEVELS.findLast((level) => level < value);
    if (lowerZoomLevel) {
      set(lowerZoomLevel);
    }
  }, [set, value]);

  const zoomBy = useCallback(
    (delta: number) => {
      set(Math.max(0.01, value + delta));
    },
    [set, value]
  );

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
      label: 'Zoom in',
      defaultShortcut: ['alt', '+'],
      actionName: 'zoomPlus',
      action: zoomIn,
    });
    api.setAddonShortcut('zoom', {
      label: 'Zoom out',
      defaultShortcut: ['alt', '-'],
      actionName: 'zoomOut',
      action: zoomOut,
    });
  }, [api, zoomIn, zoomOut, zoomTo]);

  return <Zoom key="zoom" {...{ value, zoomIn, zoomOut, zoomTo, zoomBy }} />;
});

export const zoomTool: Addon_BaseType = {
  title: 'zoom',
  id: 'zoom',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => <ZoomConsumer>{(zoomContext) => <ZoomWrapper {...zoomContext} />}</ZoomConsumer>,
};
