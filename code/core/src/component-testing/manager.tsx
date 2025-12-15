import React from 'react';

import { AddonPanel } from 'storybook/internal/components';

import { type API_StoryEntry, type Combo, Consumer, addons, types } from 'storybook/manager-api';

import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants';

export default addons.register(ADDON_ID, () => {
  if (globalThis?.FEATURES?.interactions) {
    const filter = ({ state }: Combo) => {
      const origin = (state.refId && state.refs[state.refId]?.url) || document.location.origin;
      const { pathname, search = '' } = state.location;
      const path = pathname + (state.refId ? search.replace(`/${state.refId}_`, '/') : search);
      return {
        refId: state.refId,
        storyId: state.storyId,
        storyUrl: origin + path,
      };
    };

    addons.add(PANEL_ID, {
      type: types.PANEL,
      title: () => <PanelTitle />,
      match: ({ viewMode }) => viewMode === 'story',
      disabled: (parameters: API_StoryEntry['parameters']) => {
        return !!parameters?.[PARAM_KEY]?.disable;
      },
      render: ({ active }) => {
        return (
          <AddonPanel active={!!active}>
            <Consumer filter={filter}>{(props) => <Panel {...props} />}</Consumer>
          </AddonPanel>
        );
      },
    });
  }
});
