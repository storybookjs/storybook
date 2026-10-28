import React from 'react';

import type { Decorator } from '@storybook/react-vite';

import { fn } from '@storybook/core/test';

import { defaultShortcuts } from './defaultShortcuts.tsx';
import { ShortcutsScreen } from './shortcuts.tsx';

const actions = {
  setShortcut: fn(),
  restoreDefaultShortcut: fn(),
  restoreAllDefaultShortcuts: fn(),
  onClose: fn(),
};

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
