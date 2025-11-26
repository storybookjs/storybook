import React from 'react';

import { Badge } from 'storybook/internal/components';

import { useAddonState, useStorybookApi } from 'storybook/manager-api';

import { CallStates } from '../../instrumenter/types';
import { ADDON_ID, PANEL_ID } from '../constants';
import type { PanelState } from './Panel';
import { StatusIcon } from './StatusIcon';

export function PanelTitle() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const [addonState = {}] = useAddonState<PanelState>(ADDON_ID);
  const { status, hasException, interactionsCount } = addonState as PanelState;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Interactions</span>
      {interactionsCount && status !== 'errored' && !hasException ? (
        <Badge compact status={selectedPanel === PANEL_ID ? 'active' : 'neutral'}>
          {interactionsCount}
        </Badge>
      ) : null}
      {status === 'errored' || hasException ? <StatusIcon status={CallStates.ERROR} /> : null}
    </div>
  );
}
