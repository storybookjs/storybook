import React from 'react';

import { ChevronDownIcon, CopyIcon } from '@storybook/icons';
import { srOnlyStyles, styled } from 'storybook/theming';

import type { ClassifiedError } from '../../../classified-error.ts';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { Badge } from '../Badge/Badge.tsx';
import { Button } from '../Button/Button.tsx';
import { Collapsible, useCollapsible } from '../Collapsible/Collapsible.tsx';
import { Link } from '../typography/link/link.tsx';
import { ActionsRow, CardShell, Row } from './shared.tsx';

/** The severity pill's label, keyed by the classifier's severity decision. */
const SEVERITY_LABELS: Record<ClassifiedError['severity'], string> = {
  negative: 'Error',
  critical: 'Critical',
};

/**
 * One presentation decision per kind — border/pill tone and docs-link label. Exhaustive on
 * purpose: adding a kind to the contract fails to compile here until someone decides its
 * presentation, and a tone flip is a one-line data change.
 */
const KIND_PRESENTATION: Record<
  ClassifiedError['kind'],
  { tone: 'neutral' | 'error'; docsLabel: string }
> = {
  'render-exception': { tone: 'error', docsLabel: 'View docs' },
  'story-not-found': { tone: 'neutral', docsLabel: 'Troubleshoot' },
  'app-config': { tone: 'error', docsLabel: 'View docs' },
  // Unreachable through the narrowed prop below — DependencyNotice owns this kind — but the
  // entry keeps the map exhaustive and honest about what a dependency error would look like.
  dependency: { tone: 'neutral', docsLabel: 'Troubleshoot' },
  'manager-crash': { tone: 'error', docsLabel: 'View docs' },
};

/** `dependency` is excluded: DependencyNotice is that kind's single owner. */
export type RenderableErrorKind = Exclude<ClassifiedError['kind'], 'dependency'>;

const Container = styled(CardShell)<{
  severity: ClassifiedError['severity'];
  tone: 'neutral' | 'error';
}>(({ theme, tone, severity }) => ({
  border: `1px solid ${tone === 'neutral' ? theme.appBorderColor : theme.borderColor[severity]}`,
}));

/** Flex-column stretch would widen the pill across the card; anchor it to the start. */
const PillSlot = styled.div({
  alignSelf: 'flex-start',
});

/**
 * Failure transitions are announced through an implicit live region so assistive tech reports
 * them without focus moves (WCAG 4.1.3). `role="alert"` is assertive, `role="status"` polite.
 */
const LiveAnnouncement = styled.span(srOnlyStyles);

const Title = styled.h3(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
}));

const Cause = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.textMutedColor,
}));

const CodeBlock = styled.pre(({ theme }) => ({
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

const StackBlock = styled(CodeBlock)({
  maxHeight: 240,
  overflowY: 'auto',
});

const AccentLine = styled.span(({ theme }) => ({
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

export interface ErrorDetailsProps {
  /**
   * The classified error to render — produced by `classifyError`, never composed on a surface.
   * `dependency` is not accepted here: a blocked-from-above panel renders `DependencyNotice`,
   * which is that kind's single owner.
   */
  error: Omit<ClassifiedError, 'kind'> & { kind: RenderableErrorKind };
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
  const collapsible = useCollapsible({ initialCollapsed: true });
  const { tone, docsLabel } = KIND_PRESENTATION[error.kind];
  const { codeFrame } = error;

  // One raw-detail string feeds both the expanded block and Copy error, so what users copy is
  // exactly what they read.
  const rawDetail = [
    error.stack,
    error.componentStack ? `Component Stack:\n${error.componentStack}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
  const copyContent = [error.message, rawDetail].filter(Boolean).join('\n\n');
  const copyButton = useCopyButton({
    children: 'Copy error',
    childrenOnCopy: 'Copied!',
    content: copyContent,
    // Text buttons carry their accessible name in their visible text — the hook default
    // (`ariaLabel: false`) keeps Button's text-button aria-label deprecation quiet.
    ariaLabelOnCopy: 'Error copied to clipboard',
  });

  return (
    <Container severity={error.severity} tone={tone} data-kind={error.kind} data-tone={tone}>
      <LiveAnnouncement role={error.severity === 'critical' ? 'alert' : 'status'}>
        {error.title}
      </LiveAnnouncement>
      {tone === 'error' ? (
        <PillSlot>
          <Badge status={error.severity}>{SEVERITY_LABELS[error.severity]}</Badge>
        </PillSlot>
      ) : null}
      <Title>{error.title}</Title>
      {error.cause ? <Cause>{error.cause}</Cause> : null}
      <CodeBlock>
        {error.testPath ? <AccentLine>FAIL {error.testPath}</AccentLine> : null}
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
                <AccentLine key={index}>{line}</AccentLine>
              ) : (
                <React.Fragment key={index}>{line}</React.Fragment>
              );
            })}
          </>
        ) : null}
      </CodeBlock>
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
          <Row>
            <Button variant="ghost" size="small" ariaLabel={false} {...collapsible.toggleProps}>
              <ChevronDownIcon />
              {collapsible.isCollapsed ? 'Expand error' : 'Collapse error'}
            </Button>
            <Button variant="ghost" size="small" {...copyButton.buttonProps}>
              <CopyIcon />
              {copyButton.children}
            </Button>
          </Row>
          {/* Collapsible keeps the content mounted with aria-hidden, so aria-controls on the
              toggle always points at an element in the DOM. */}
          <Collapsible state={collapsible} data-testid="raw-detail">
            <StackBlock>{rawDetail}</StackBlock>
          </Collapsible>
        </>
      ) : null}
      {action || error.docsUrl || links ? (
        <ActionsRow>
          {action}
          {error.docsUrl ? (
            <Link href={error.docsUrl} target="_blank" withArrow>
              {docsLabel}
            </Link>
          ) : null}
          {links}
        </ActionsRow>
      ) : null}
    </Container>
  );
};
