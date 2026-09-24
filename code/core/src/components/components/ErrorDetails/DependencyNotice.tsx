import React from 'react';

import { styled } from 'storybook/theming';

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: theme.appBorderRadius,
  background: theme.background.content,
  border: `1px solid ${theme.appBorderColor}`,
  color: theme.color.defaultText,
}));

const Cause = styled.strong(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const Workaround = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.textMutedColor,
}));

const ActionsRow = styled.div({
  display: 'flex',
  gap: 12,
  alignItems: 'center',
});

export interface DependencyNoticeProps {
  /** What failed upstream and blocks this panel, in plain language. */
  cause: string;
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
export const DependencyNotice = ({ cause, workaround, action }: DependencyNoticeProps) => (
  // The upstream failure replacing the panel's content is a state transition assistive tech
  // must report (WCAG 4.1.3); `role="status"` makes the whole notice an implicit polite region.
  <Container role="status">
    <Cause>{cause}</Cause>
    {workaround ? <Workaround>{workaround}</Workaround> : null}
    {action ? <ActionsRow>{action}</ActionsRow> : null}
  </Container>
);
