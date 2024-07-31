import React from 'react';
import { actions as makeActions } from '@storybook/addon-actions';

import type { Decorator } from '@storybook/react';
import { ShortcutsScreen } from './shortcuts';
import { defaultShortcuts } from './defaultShortcuts';

const actions = makeActions(
  'setShortcut',
  'restoreDefaultShortcut',
  'restoreAllDefaultShortcuts',
  'onClose'
);

export default {
  component: ShortcutsScreen,
  title: 'Settings/ShortcutsScreen',
  decorators: [
    ((StoryFn, c) => (
      <div
        style={{
          position: 'relative',
          height: 'calc(100vh)',
          width: 'calc(100vw)',
        }}
      >
        <StoryFn {...c} />
      </div>
    )) as Decorator,
  ],
};

export const Defaults = () => <ShortcutsScreen shortcutKeys={defaultShortcuts} {...actions} />;
Defaults.storyName = 'default shortcuts';
