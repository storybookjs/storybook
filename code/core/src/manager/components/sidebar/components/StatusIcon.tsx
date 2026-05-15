import React, { type ComponentProps, type FC } from 'react';

import type { StatusValue } from 'storybook/internal/types';

import {
  StatusFailIcon,
  StatusNewIcon,
  StatusPassIcon,
  StatusWarnIcon,
  SyncIcon,
} from '@storybook/icons';

import { color, styled, useTheme } from 'storybook/theming';

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

const StyledSymbolIcon = styled.svg<{ $color: string }>(({ $color }) => ({
  color: $color,
  width: 12,
  height: 12,
}));

const NewStatusIcon: FC = () => {
  const theme = useTheme();
  return <StyledSymbolIcon $color={theme.fgColor.accent} type="change-new" />;
};

const ModifiedStatusIcon: FC = () => {
  const theme = useTheme();
  return <StyledSymbolIcon $color={theme.fgColor.accent} type="change-modified" />;
};

const AffectedStatusIcon: FC = () => {
  const theme = useTheme();
  return <StyledSymbolIcon $color={theme.fgColor.accent} type="change-affected" />;
};

export const StatusIconMap: Record<StatusValue, React.ReactNode | null> = {
  'status-value:success': <SuccessStatusIcon />,
  'status-value:error': <ErrorStatusIcon />,
  'status-value:warning': <WarnStatusIcon />,
  'status-value:pending': <PendingStatusIcon />,
  'status-value:new': <NewStatusIcon />,
  'status-value:modified': <ModifiedStatusIcon />,
  'status-value:affected': <AffectedStatusIcon />,
  'status-value:unknown': null,
};
