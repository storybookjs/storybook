import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { ADDON_ID } from './constants.ts';
import { HighlightMenu } from './menu.tsx';

const HIGHLIGHT_MENU_ADDON_ID = `${ADDON_ID}/manager`;

export default addons.register(HIGHLIGHT_MENU_ADDON_ID, (api) => {
  if (globalThis?.FEATURES?.highlight) {
    addons.add(HIGHLIGHT_MENU_ADDON_ID, {
      type: types.PREVIEW,
      render: ({ children }) => (
        <>
          {children}
          <HighlightMenu api={api} />
        </>
      ),
    });
  }
});
