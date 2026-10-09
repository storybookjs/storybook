import type { ReactNode } from 'react';
import React from 'react';

import { StateShell } from './StateShell.tsx';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/**
 * Renders guidance for an empty region. Carries no severity; use `ErrorState` for failures.
 */
export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <StateShell title={title} summary={description} actions={action} />
);
