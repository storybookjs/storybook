import React from 'react';

import { Badge } from 'storybook/internal/components';

import { useAddonState, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, PANEL_ID } from '../constants';

export function PanelTitle() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const [addonState = {}] = useAddonState(ADDON_ID);
  const { hasException, interactionsCount } = addonState as any;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Component tests</span>
      {interactionsCount && !hasException ? (
        <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'neutral'}>
          {interactionsCount}
        </Badge>
      ) : null}
      {hasException ? (
        <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'negative'}>
          {interactionsCount}
        </Badge>
      ) : null}
    </div>
  );
}
