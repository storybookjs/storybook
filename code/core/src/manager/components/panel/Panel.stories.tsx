import type { EventHandler, FocusEvent, MouseEvent } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Badge, Spaced } from '@storybook/core/components';
import type { Addon_BaseType, Addon_Collection } from '@storybook/core/types';
import { Addon_TypesEnum } from '@storybook/core/types';
import { BellIcon } from '@storybook/icons';
import { AddonPanel } from './Panel';
import { defaultShortcuts } from '../../settings/defaultShortcuts';

const onSelect = action('onSelect');
const toggleVisibility = action('toggleVisibility');
const togglePosition = action('togglePosition');

const panels: Addon_Collection<Addon_BaseType> = {
  test1: {
    title: 'Test 1',
    type: Addon_TypesEnum.PANEL,
    render: ({ active }) => (active ? <div id="test1">TEST 1</div> : null),
  },
  test2: {
    title: 'Test 2',
    type: Addon_TypesEnum.PANEL,
    render: ({ active }) => (active ? <div id="test2">TEST 2</div> : null),
  },
};

export default {
  title: 'Panel',
  component: AddonPanel,
};

export const Default = () => {
  const [selectedPanel, setSelectedPanel] = useState('test2');
  return (
    <AddonPanel
      absolute={false}
      panels={panels}
      actions={{ onSelect: setSelectedPanel, toggleVisibility, togglePosition }}
      selectedPanel={selectedPanel}
      shortcuts={defaultShortcuts}
    />
  );
};

export const JSXTitles = () => {
  const [selectedPanel, setSelectedPanel] = useState('function-string');
  return (
    <AddonPanel
      absolute={false}
      panels={{
        'function-string': {
          type: Addon_TypesEnum.PANEL,
          title: () => 'Test 1',
          render: ({ active }) => (active ? <div id="test1">TEST as string</div> : null),
        },
        'function-jsx': {
          type: Addon_TypesEnum.PANEL,
          title: () => (
            <div>
              <Spaced col={1}>
                <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>Test 1</div>
                <Badge status="critical">4</Badge>
              </Spaced>
            </div>
          ),
          render: ({ active }) => (active ? <div id="test1">TEST with label</div> : null),
        },
        'function-jsx-icon': {
          type: Addon_TypesEnum.PANEL,
          title: () => (
            <div>
              <Spaced col={1}>
                <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>Alert!</div>
                <BellIcon />
              </Spaced>
            </div>
          ),
          render: ({ active }) => (active ? <div id="test1">TEST with label</div> : null),
        },
        'function-jsx-state': {
          type: Addon_TypesEnum.PANEL,
          title: () => {
            const MAX = 10;
            const [count, setCount] = useState(0);
            const timer = useRef(null);

            const startTimer = useCallback<EventHandler<MouseEvent<any>>>((event) => {
              event.stopPropagation();
              if (timer.current) {
                return;
              }
              // @ts-expect-error (non strict)
              timer.current = setInterval(() => {
                setCount((c) => {
                  if (c === MAX) {
                    // @ts-expect-error (non strict)
                    clearInterval(timer.current);
                    timer.current = null;
                    return c;
                  }
                  return c + 1;
                });
              }, 1000);
            }, []);
            const stopTimer = useCallback<EventHandler<MouseEvent<any> | FocusEvent<any>>>(
              (event) => {
                event.stopPropagation();
                if (timer.current) {
                  clearInterval(timer.current);
                  timer.current = null;
                }
              },
              []
            );

            return (
              <div
                onMouseEnter={startTimer}
                onMouseLeave={stopTimer}
                onBlur={stopTimer}
                tabIndex={-1}
              >
                <Spaced col={1}>
                  <div style={{ display: 'inline-block' }}>Hover over me!</div>
                  {count ? (
                    <Badge status={count > 8 ? 'critical' : 'warning'}>{count}</Badge>
                  ) : null}
                </Spaced>
              </div>
            );
          },
          render: ({ active }) => {
            return active ? <div id="test1">TEST with timer</div> : null;
          },
        },
      }}
      actions={{ onSelect: setSelectedPanel, toggleVisibility, togglePosition }}
      selectedPanel={selectedPanel}
      shortcuts={defaultShortcuts}
    />
  );
};

export const NoPanels = () => (
  <AddonPanel
    panels={{}}
    actions={{ onSelect, toggleVisibility, togglePosition }}
    shortcuts={defaultShortcuts}
  />
);
