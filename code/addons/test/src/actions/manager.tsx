import React from 'react';

import { useStorybookApi } from 'storybook/internal/manager-api';

import ActionLogger from './containers/ActionLogger';

export const ActionPanel = () => {
  const api = useStorybookApi();
  return <ActionLogger active api={api} />;
};
