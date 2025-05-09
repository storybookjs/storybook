import React from 'react';

import { AddonPanel } from 'storybook/internal/components';

import { type Combo, Consumer, addons, types } from 'storybook/manager-api';

import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { ADDON_ID, PANEL_ID } from './constants';

export default addons.register(ADDON_ID, () => {
  if (globalThis?.FEATURES?.interactions) {
    const filter = ({ state }: Combo) => {
      return {
        storyId: state.storyId,
      };
    };

    addons.add(PANEL_ID, {
      type: types.PANEL,
      title: () => <PanelTitle />,
      match: ({ viewMode }) => viewMode === 'story',
      render: ({ active }) => {
        return (
          <AddonPanel active={active} allowError={false}>
            <Consumer filter={filter}>{({ storyId }) => <Panel storyId={storyId} />}</Consumer>
          </AddonPanel>
        );
      },
    });
  }
});
