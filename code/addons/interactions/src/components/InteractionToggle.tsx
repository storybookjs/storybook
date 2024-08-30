import React, { useCallback } from 'react';

import { IconButton } from 'storybook/internal/components';

import { PlayIcon, StopIcon } from '@storybook/icons';

import { ADDON_ID } from '../constants';

export const TOOL_ID = `${ADDON_ID}/tool`;

export const InteractionToggle = () => {
  const [disableInteractions, setDisableInteractions] = React.useState(
    window?.localStorage.getItem('disableInteractions') === 'true'
  );

  const toggleMyTool = useCallback(() => {
    window?.localStorage?.setItem('disableInteractions', `${!disableInteractions}`);
    setDisableInteractions(!disableInteractions);
  }, [disableInteractions, setDisableInteractions]);

  return (
    <IconButton
      key={TOOL_ID}
      aria-label={`${disableInteractions ? 'Enable' : 'disable'} Interactions`}
      title={`${disableInteractions ? 'Enable' : 'disable'} Interactions`}
      onClick={toggleMyTool}
      defaultChecked={disableInteractions}
      aria-pressed={disableInteractions}
    >
      {disableInteractions ? <PlayIcon /> : <StopIcon />}
      <span>Interactions</span>
    </IconButton>
  );
};
