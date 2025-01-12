import type { FC } from 'react';
import React from 'react';

import { Consumer } from '@storybook/core/manager-api';

import { ShortcutsScreen } from './shortcuts';

const ShortcutsPage: FC = () => (
  <Consumer>
    {({
      api: {
        getShortcutKeys,
        getAddonsShortcutLabels,
        setShortcut,
        restoreDefaultShortcut,
        restoreAllDefaultShortcuts,
      },
    }) => (
      <ShortcutsScreen
        shortcutKeys={getShortcutKeys()}
        addonsShortcutLabels={getAddonsShortcutLabels()}
        {...{ setShortcut, restoreDefaultShortcut, restoreAllDefaultShortcuts }}
      />
    )}
  </Consumer>
);

export { ShortcutsPage };
