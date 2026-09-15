import type { ReactNode } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

import { Badge } from '../Badge/Badge.tsx';

/** Per the error-states spec: negative for standard errors, critical for fatal full-page states. */
export type ErrorSeverity = 'negative' | 'critical';

const severityLabels: Record<ErrorSeverity, string> = {
  negative: 'Error',
  critical: 'Critical',
};

interface StateShellProps {
  severity?: ErrorSeverity;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
}

const Shell = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 15,
  maxWidth: 415,
  textAlign: 'center',
});

const Copy = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const Title = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2 - 1,
  color: theme.color.defaultText,
}));

const Summary = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.regular,
  fontSize: theme.typography.size.s2 - 1,
  color: theme.textMutedColor,
}));

const Actions = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
}));

export const StateShell = ({ severity, title, summary, actions }: StateShellProps) => (
  <Shell>
    {severity && <Badge status={severity}>{severityLabels[severity]}</Badge>}
    <Copy>
      <Title>{title}</Title>
      {summary && <Summary>{summary}</Summary>}
    </Copy>
    {actions && <Actions>{actions}</Actions>}
  </Shell>
);
