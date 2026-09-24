import React, { useId, useState } from 'react';

import { ChevronDownIcon, CopyIcon } from '@storybook/icons';
import { styled } from 'storybook/theming';

import type { ClassifiedError } from '../../../classified-error.ts';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { Badge } from '../Badge/Badge.tsx';
import { Button } from '../Button/Button.tsx';
import { Link } from '../typography/link/link.tsx';

/** The severity pill's label, keyed by the classifier's severity decision. */
const SEVERITY_LABELS: Record<ClassifiedError['severity'], string> = {
  negative: 'Error',
  critical: 'Critical',
};

const Container = styled.div<{ severity: ClassifiedError['severity']; neutral: boolean }>(
  ({ theme, neutral, severity }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: theme.appBorderRadius,
    background: theme.background.content,
    border: `1px solid ${neutral ? theme.appBorderColor : theme.borderColor[severity]}`,
    color: theme.color.defaultText,
  })
);

/** Flex-column stretch would widen the pill across the card; anchor it to the start. */
const PillSlot = styled.div({
  alignSelf: 'flex-start',
});

/**
 * Failure transitions are announced through an implicit live region so assistive tech reports
 * them without focus moves (WCAG 4.1.3). `role="alert"` is assertive, `role="status"` polite.
 */
const LiveAnnouncement = styled.span({
  position: 'absolute',
  width: 1,
  height: 1,
  clipPath: 'inset(50%)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});

const Title = styled.h3(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
}));

const Cause = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.textMutedColor,
}));

const Diagnostics = styled.pre(({ theme }) => ({
  margin: 0,
  padding: 12,
  borderRadius: theme.appBorderRadius,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
}));

const CaretLine = styled.span(({ theme }) => ({
  color: theme.fgColor.negative,
  fontWeight: theme.typography.weight.bold,
}));

const SummaryLine = styled.span(({ theme }) => ({
  color: theme.fgColor.negative,
  fontWeight: theme.typography.weight.bold,
}));

const Metadata = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s1,

  code: {
    padding: '1px 4px',
    borderRadius: 3,
    background: theme.background.app,
    border: `1px solid ${theme.appBorderColor}`,
  },
}));

const StackBlock = styled.pre(({ theme }) => ({
  margin: 0,
  padding: 12,
  borderRadius: theme.appBorderRadius,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
  maxHeight: 240,
  overflowY: 'auto',
}));

const DetailsRow = styled.div({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
});

const ActionsRow = styled.div({
  display: 'flex',
  gap: 12,
  alignItems: 'center',
});

export interface ErrorDetailsProps {
  /** The classified error to render — produced by `classifyError`, never composed on a surface. */
  error: ClassifiedError;
  /**
   * The surface's one primary recovery action, named for the surface (Rerun story / Reload /
   * Run scan). Rendered as the leading action; secondary links follow.
   */
  action?: React.ReactNode;
  /** Additional secondary links for surfaces that have them (View in CLI, Troubleshoot). */
  links?: React.ReactNode;
}

/**
 * The shared error anatomy: severity pill, human title, formatted diagnostics with the raw
 * detail collapsed, one recovery action. Props in, DOM out — it reads no global state, and
 * every rendered string flows from the `ClassifiedError` the classifier produced.
 */
export const ErrorDetails = ({ error, action, links }: ErrorDetailsProps) => {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);

  const copyContent = [error.message, error.stack, error.componentStack]
    .filter(Boolean)
    .join('\n\n');
  const copyButton = useCopyButton({
    children: 'Copy error',
    childrenOnCopy: 'Copied!',
    content: copyContent,
    // Text buttons carry their accessible name in their visible text — the hook default
    // (`ariaLabel: false`) keeps Button's text-button aria-label deprecation quiet.
    ariaLabelOnCopy: 'Error copied to clipboard',
  });

  // Not-found is navigation, not a component failure — no error styling (AC3).
  const neutral = error.kind === 'story-not-found';
  const { codeFrame } = error;

  return (
    <Container severity={error.severity} neutral={neutral} data-kind={error.kind}>
      <LiveAnnouncement role={error.severity === 'critical' ? 'alert' : 'status'}>
        {error.title}
      </LiveAnnouncement>
      {neutral ? null : (
        <PillSlot>
          <Badge status={error.severity}>{SEVERITY_LABELS[error.severity]}</Badge>
        </PillSlot>
      )}
      <Title>{error.title}</Title>
      {error.cause ? <Cause>{error.cause}</Cause> : null}
      <Diagnostics>
        {error.testPath ? <SummaryLine>FAIL {error.testPath}</SummaryLine> : null}
        {error.message}
        {codeFrame ? (
          <>
            {'\n'}
            {codeFrame.lines.map((line, index) => {
              // The contract's `caret` is file-absolute — it carries no index into `lines` —
              // and `parseCodeFrame` emits exactly one line, the caret line, so the caret is
              // the last line by contract, not by coincidence. Multi-line context frames need
              // a contract-side caret index first. Key by index: recursive stacks repeat
              // frame lines and content keys collide.
              const isCaretLine = index === codeFrame.lines.length - 1;
              return isCaretLine ? (
                <CaretLine key={index}>{line}</CaretLine>
              ) : (
                <React.Fragment key={index}>{line}</React.Fragment>
              );
            })}
          </>
        ) : null}
      </Diagnostics>
      {codeFrame || error.errorCode ? (
        <Metadata>
          {codeFrame ? (
            <span>
              {codeFrame.file}:{codeFrame.line}
              {codeFrame.column === undefined ? '' : `:${codeFrame.column}`}
            </span>
          ) : null}
          {error.errorCode ? <code>{error.errorCode}</code> : null}
        </Metadata>
      ) : null}
      {error.stack ? (
        <>
          <DetailsRow>
            <Button
              variant="ghost"
              size="small"
              ariaLabel={false}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronDownIcon />
              {expanded ? 'Collapse error' : 'Expand error'}
            </Button>
            <Button variant="ghost" size="small" {...copyButton.buttonProps}>
              <CopyIcon />
              {copyButton.children}
            </Button>
          </DetailsRow>
          {expanded ? (
            <StackBlock id={detailsId}>
              {error.stack}
              {error.componentStack ? `\n\nComponent Stack:\n${error.componentStack}` : ''}
            </StackBlock>
          ) : null}
        </>
      ) : null}
      {action || error.docsUrl || links ? (
        <ActionsRow>
          {action}
          {error.docsUrl ? (
            <Link href={error.docsUrl} target="_blank" withArrow>
              {neutral ? 'Troubleshoot' : 'View docs'}
            </Link>
          ) : null}
          {links}
        </ActionsRow>
      ) : null}
    </Container>
  );
};
