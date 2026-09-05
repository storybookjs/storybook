import React from 'react';

import { Badge } from 'storybook/internal/components';

import { useStorybookApi } from 'storybook/manager-api';

import { CallStates } from '../../instrumenter/types.ts';
import { PANEL_ID } from '../constants.ts';
import { StatusIcon } from './StatusIcon.tsx';
import { usePanelState } from './store.ts';

export function PanelTitle() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const { status, hasException, interactionsCount } = usePanelState();

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
