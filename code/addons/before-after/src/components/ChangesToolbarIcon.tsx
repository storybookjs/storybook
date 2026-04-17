import React from 'react';

import { experimental_useStatusStore, useStorybookApi } from 'storybook/manager-api';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';
import type { StatusesByStoryIdAndTypeId } from 'storybook/internal/types';
import { IconButton } from 'storybook/internal/components';

import { ChangedIcon } from '@storybook/icons';

import { CHANGES_URL } from '../constants.ts';

export const ChangesToolbarIcon = () => {
  const api = useStorybookApi();
  const hasChanges = experimental_useStatusStore((allStatuses: StatusesByStoryIdAndTypeId) =>
    Object.entries(allStatuses).some(
      ([, byTypeId]) => byTypeId[CHANGE_DETECTION_STATUS_TYPE_ID] != null
    )
  );

  if (!hasChanges) {
    return null;
  }

  const handleClick = () => {
    // Don't set filters here — ChangesPage manages filter save/restore on mount/unmount
    api.navigate(CHANGES_URL);
  };

  return (
    <IconButton key="changes" title="View changes" onClick={handleClick}>
      <ChangedIcon />
    </IconButton>
  );
};
