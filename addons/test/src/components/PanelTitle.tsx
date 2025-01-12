import React from 'react';

import { Badge, Spaced } from 'storybook/internal/components';
import { useAddonState } from 'storybook/internal/manager-api';

import { ADDON_ID } from '../constants';

export function PanelTitle() {
  const [addonState = {}] = useAddonState(ADDON_ID);
  const { hasException, interactionsCount } = addonState as any;

  return (
    <div>
      <Spaced col={1}>
        <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>Component tests</span>
        {interactionsCount && !hasException ? (
          <Badge status="neutral">{interactionsCount}</Badge>
        ) : null}
        {hasException ? <Badge status="negative">{interactionsCount}</Badge> : null}
      </Spaced>
    </div>
  );
}
