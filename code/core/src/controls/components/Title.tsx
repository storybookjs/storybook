import type React from 'react';

import { Badge } from '../../components';
import { useArgTypes, useStorybookApi } from '../../manager-api';
import { ADDON_ID } from '../constants';

export function Title() {
  const api = useStorybookApi();
  const selectedPanel = api.getSelectedPanel();
  const rows = useArgTypes();
  const controlsCount = Object.values(rows).filter(
    (argType) => argType?.control && !argType?.table?.disable
  ).length;
  const suffix =
    controlsCount === 0 ? null : (
      <Badge compact status={selectedPanel === ADDON_ID ? 'active' : 'neutral'}>
        {controlsCount}
      </Badge>
    );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>Controls</span>
      {suffix}
    </div>
  );
}
