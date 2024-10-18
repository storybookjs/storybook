import React, { useCallback } from 'react';

import { AddonPanel, Badge, Spaced } from 'storybook/internal/components';
import type { Combo } from 'storybook/internal/manager-api';
import { Consumer, addons, types, useAddonState } from 'storybook/internal/manager-api';

import { Panel } from './Panel';
import { InteractionToggle } from './components/InteractionToggle';
import { ADDON_ID, PANEL_ID } from './constants';

function Title() {
  const [addonState = {}] = useAddonState(ADDON_ID);
  const { hasException, interactionsCount } = addonState as any;

  return (
    <div>
      <Spaced col={1}>
        <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>Interactions</span>
        {interactionsCount && !hasException ? (
          <Badge status="neutral">{interactionsCount}</Badge>
        ) : null}
        {hasException ? <Badge status="negative">{interactionsCount}</Badge> : null}
      </Spaced>
    </div>
  );
}

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: '',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => <InteractionToggle />,
  });

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: Title,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const newLocal = useCallback(({ state }: Combo) => {
        return {
          storyId: state.storyId,
        };
      }, []);

      return (
        <AddonPanel active={active}>
          <Consumer filter={newLocal}>{({ storyId }) => <Panel storyId={storyId} />}</Consumer>
        </AddonPanel>
      );
    },
  });
});
