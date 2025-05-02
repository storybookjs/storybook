import React from 'react';

import { Badge } from 'storybook/internal/components';

import { useAddonState, useStorybookApi } from 'storybook/manager-api';

import { CallStates } from '../../instrumenter/types';
import { ADDON_ID, PANEL_ID } from '../constants';
import { StatusIcon } from './StatusIcon';

export function PanelTitle() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const [addonState = {}] = useAddonState(ADDON_ID);
  const { isErrored, hasException, interactionsCount } = addonState as any;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Interactions</span>
      {interactionsCount && !isErrored && !hasException ? (
        <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'neutral'}>
          {interactionsCount}
        </Badge>
      ) : null}
      {isErrored || hasException ? <StatusIcon status={CallStates.ERROR} /> : null}
    </div>
  );
}
