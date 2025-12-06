import React, { type FC, useEffect, useState } from 'react';

import { ToggleButton } from 'storybook/internal/components';

import { GrowIcon } from '@storybook/icons';

import { type API } from 'storybook/manager-api';

import { registerShortcuts } from '../shortcuts';
import { useViewport } from '../useViewport';

export const ViewportTool: FC<{ api: API }> = ({ api }) => {
  const viewport = useViewport();
  const { key, width, height, isDefault, isLocked, options, reset, select } = viewport;
  const [lastUsedViewport, setLastUsedViewport] = useState<string | null>(key);

  useEffect(() => {
    if (key && !isDefault && !isLocked) {
      setLastUsedViewport(key);
    }
  }, [key, isDefault, isLocked]);

  useEffect(() => {
    registerShortcuts(api, viewport);
  }, [api, viewport]);

  if (!width || !height || !Object.keys(options).length) {
    return null;
  }

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key="viewport"
      pressed={!isDefault || isLocked}
      disabled={isLocked}
      ariaLabel={isLocked ? 'Viewport size set by story parameters' : 'Viewport'}
      tooltip={isLocked ? 'Viewport size set by story parameters' : 'Change viewport'}
      onClick={() => (isDefault ? select(lastUsedViewport || Object.keys(options)[0]) : reset())}
    >
      <GrowIcon />
    </ToggleButton>
  );
};
