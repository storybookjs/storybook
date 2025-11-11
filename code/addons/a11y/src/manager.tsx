import React from 'react';

import { Badge } from 'storybook/internal/components';

import { addons, types, useAddonState, useStorybookApi } from 'storybook/manager-api';

import { A11YPanel } from './components/A11YPanel';
import { A11yContextProvider } from './components/A11yContext';
import { VisionSimulator } from './components/VisionSimulator';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants';
import type { EnhancedResults, Status } from './types';
import { RuleType } from './types';

const Title = () => {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const [{ results }] = useAddonState<{
    ui: { highlighted: boolean; tab: RuleType };
    results: EnhancedResults | undefined;
    error: unknown;
    status: Status;
  }>(ADDON_ID, {
    ui: {
      highlighted: false,
      tab: RuleType.VIOLATION,
    },
    results: undefined,
    error: undefined,
    status: 'initial',
  });
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

addons.register(ADDON_ID, (_api) => {
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
