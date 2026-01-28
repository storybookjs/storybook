import React, { type ComponentProps, type FC } from 'react';

import type { StatusValue } from 'storybook/internal/types';

import { StatusFailIcon, StatusPassIcon, StatusWarnIcon, SyncIcon } from '@storybook/icons';

import { useTheme } from 'storybook/theming';

const SuccessStatusIcon: FC<ComponentProps<typeof StatusPassIcon>> = (props) => {
  const theme = useTheme();
  return <StatusPassIcon {...props} color={theme.color.positive} />;
};

const ErrorStatusIcon: FC<ComponentProps<typeof StatusFailIcon>> = (props) => {
  const theme = useTheme();
  return <StatusFailIcon {...props} color={theme.color.negative} />;
};

const WarnStatusIcon: FC<ComponentProps<typeof StatusWarnIcon>> = (props) => {
  const theme = useTheme();
  return <StatusWarnIcon {...props} color={theme.color.warning} />;
};

const PendingStatusIcon: FC<ComponentProps<typeof SyncIcon>> = (props) => {
  const theme = useTheme();
  return <SyncIcon {...props} size={12} color={theme.color.defaultText} />;
};

export const StatusIconMap: Record<StatusValue, React.ReactNode | null> = {
  'status-value:success': <SuccessStatusIcon />,
  'status-value:error': <ErrorStatusIcon />,
  'status-value:warning': <WarnStatusIcon />,
  'status-value:pending': <PendingStatusIcon />,
  'status-value:unknown': null,
};
