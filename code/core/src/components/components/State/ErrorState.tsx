import type { ReactNode } from 'react';
import React from 'react';

import type { ErrorSeverity } from './StateShell.tsx';
import { StateShell } from './StateShell.tsx';

interface ErrorStateProps {
  severity: ErrorSeverity;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
}

/**
 * Renders a failure state. Requires a severity; use `EmptyState` for guidance.
 */
export const ErrorState = ({ severity, title, summary, actions }: ErrorStateProps) => (
  <StateShell severity={severity} title={title} summary={summary} actions={actions} />
);
