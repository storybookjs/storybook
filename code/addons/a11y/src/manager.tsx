import React from 'react';

import { Badge } from 'storybook/internal/components';

import { addons, types, useStorybookApi } from 'storybook/manager-api';

import { A11YPanel } from './components/A11YPanel.tsx';
import { A11yContextProvider } from './components/A11yContext.tsx';
import { VisionSimulator } from './components/VisionSimulator.tsx';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants.ts';
import { useA11yState } from './store.ts';

const Title = () => {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const { results } = useA11yState();
  const violationsNb = results?.violations?.length ?? 0;
  const incompleteNb = results?.incomplete?.length ?? 0;
  const count = violationsNb + incompleteNb;

  const suffix =
    count === 0 ? null : (
      <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'neutral'}>
        {count}
      </Badge>
    );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Accessibility</span>
      {suffix}
    </div>
  );
};

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: '',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => <VisionSimulator />,
  });

  addons.add(PANEL_ID, {
    title: Title,
    type: types.PANEL,
    render: ({ active = true }) => (
      <A11yContextProvider>{active ? <A11YPanel /> : null}</A11yContextProvider>
    ),
    paramKey: PARAM_KEY,
  });
});
