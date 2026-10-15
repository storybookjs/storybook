import React from 'react';

import { styled } from 'storybook/theming';

import type { ClassifiedError } from '../../../classified-error.ts';
import { ActionsRow, CardShell } from './shared.tsx';

const Container = styled(CardShell)(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
}));

const Cause = styled.strong(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const Detail = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.textMutedColor,
}));

export interface DependencyNoticeProps {
  /**
   * The classified dependency error — title and cause come from the classifier, never composed
   * on a surface. DependencyNotice is the `dependency` kind's single owner; ErrorDetails does
   * not render that kind.
   */
  error: ClassifiedError;
  /** What the user can still do meanwhile. */
  workaround?: React.ReactNode;
  /** This panel's own recovery action (e.g. a manual-run button). */
  action?: React.ReactNode;
}

/**
 * The dependency-notice pattern: when a panel cannot run because an upstream failure blocks it,
 * it says so in its own panel — stating the upstream cause, what still works, and its own
 * recovery action. The a11y panel's shipped wording is the baseline copy. The notice itself is
 * neutral — this panel has not failed, so it never wears error styling.
 */
export const DependencyNotice = ({ error, workaround, action }: DependencyNoticeProps) => (
  // The upstream failure replacing the panel's content is a state transition assistive tech
  // must report (WCAG 4.1.3); `role="status"` makes the whole notice an implicit polite region.
  <Container role="status" gap={8}>
    <Cause>{error.title}</Cause>
    {error.cause ? <Detail>{error.cause}</Detail> : null}
    {workaround ? <Detail>{workaround}</Detail> : null}
    {action ? <ActionsRow>{action}</ActionsRow> : null}
  </Container>
);
