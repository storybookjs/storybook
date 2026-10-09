import type { ReactNode } from 'react';
import React from 'react';

import type { ErrorSeverity } from './StateShell.tsx';
import { StateShell } from './StateShell.tsx';

interface ErrorStateProps {
  severity: ErrorSeverity;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  /** See `StateShellProps.showBadge`; addon panels and full-screen pages omit the badge. */
  showBadge?: boolean;
}

/**
 * Renders a failure state. Requires a severity; use `EmptyState` for guidance.
 */
export const ErrorState = ({ severity, title, summary, actions, showBadge }: ErrorStateProps) => (
  <StateShell
    severity={severity}
    title={title}
    summary={summary}
    actions={actions}
    showBadge={showBadge}
  />
);
