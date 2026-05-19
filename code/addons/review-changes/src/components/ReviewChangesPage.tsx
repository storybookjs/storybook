import React, { useEffect, useState } from 'react';

import { useChannel, useStorybookApi } from 'storybook/manager-api';
import { SyntaxHighlighter } from 'storybook/internal/components';
import { styled, useTheme } from 'storybook/theming';

import { EVENTS } from '../constants.ts';
import type { ReviewState } from '../review-state.ts';

// Unified diffs aren't a language the shared SyntaxHighlighter registers
// (only json/tsx/etc.), and the useful signal in a diff is the +/- line
// semantics — so this stays a tiny line-level helper. JSON uses the shared
// SyntaxHighlighter component below.

const HighlightedDiff: React.FC<{ text: string }> = ({ text }) => {
  const theme = useTheme();
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        let color = theme.color.defaultText;
        if (line.startsWith('@@')) {
          color = theme.color.secondary;
        } else if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
          color = theme.color.mediumdark;
        } else if (line.startsWith('+')) {
          color = theme.color.green;
        } else if (line.startsWith('-')) {
          color = theme.color.negative;
        }
        return (
          <React.Fragment key={i}>
            <span style={{ color }}>{line}</span>
            {i < lines.length - 1 ? '\n' : ''}
          </React.Fragment>
        );
      })}
    </>
  );
};

const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  minHeight: 0,
  background: theme.background.content,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s2,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  flexShrink: 0,
}));

const Title = styled.span(({ theme }) => ({
  flex: 1,
  fontWeight: theme.typography.weight.bold,
}));

const CloseButton = styled.button(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  color: theme.color.defaultText,
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: theme.typography.size.s1,
}));

const Body = styled.div({
  flex: 1,
  // A flex child needs min-height:0 to shrink below content size and scroll.
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
});

const Empty = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: theme.color.mediumdark,
}));

const Section = styled.section(({ theme }) => ({
  marginBottom: 20,
  paddingBottom: 16,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const SectionTitle = styled.h2(({ theme }) => ({
  margin: '0 0 8px',
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.color.mediumdark,
}));

const Cluster = styled.div(({ theme }) => ({
  marginBottom: 14,
  padding: 12,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 6,
}));

const ClusterHead = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  marginBottom: 4,
}));

const Kind = styled.span(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  color: theme.color.secondary,
  marginLeft: 8,
}));

const Mono = styled.code(({ theme }) => ({
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
}));

const Pre = styled.pre(({ theme }) => ({
  margin: '4px 0 0',
  padding: 10,
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 6,
  overflow: 'auto',
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,
  whiteSpace: 'pre',
}));

const List = styled.ul({ margin: '4px 0 0', paddingLeft: 18 });

const Summary = styled.summary(({ theme }) => ({
  cursor: 'pointer',
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.color.mediumdark,
}));

export interface ReviewChangesViewProps {
  state: ReviewState | null;
  onClose: () => void;
}

export const ReviewChangesView: React.FC<ReviewChangesViewProps> = ({ state, onClose }) => {
  return (
    <Page>
      <Header>
        <Title>Review changes</Title>
        <CloseButton type="button" onClick={onClose}>
          Close
        </CloseButton>
      </Header>

      {!state ? (
        <Empty>Waiting for the agent to push a review…</Empty>
      ) : (
        <Body>
          <Section>
            <SectionTitle>Narrative</SectionTitle>
            <p style={{ margin: 0 }}>{state.narrative}</p>
          </Section>

          {state.changedFiles && state.changedFiles.length > 0 && (
            <Section>
              <SectionTitle>Changed files</SectionTitle>
              <List>
                {state.changedFiles.map((f) => (
                  <li key={f}>
                    <Mono>{f}</Mono>
                  </li>
                ))}
              </List>
            </Section>
          )}

          <Section>
            <SectionTitle>Clusters ({state.clusters.length})</SectionTitle>
            {state.clusters.map((cluster, i) => (
              <Cluster key={`${cluster.label}-${i}`}>
                <ClusterHead>
                  {cluster.label}
                  {cluster.kind && <Kind>{cluster.kind}</Kind>}
                </ClusterHead>
                <div>{cluster.rationale}</div>
                <List>
                  {cluster.sampleStoryIds.map((id) => {
                    const meta = state.storyMeta?.[id];
                    return (
                      <li key={id}>
                        <Mono>{id}</Mono>
                        {meta?.depth != null && <> · depth {meta.depth}</>}
                        {meta?.chain && meta.chain.length > 0 && (
                          <> · chain: {meta.chain.join(' → ')}</>
                        )}
                      </li>
                    );
                  })}
                </List>
              </Cluster>
            ))}
          </Section>

          {state.diffHunks && state.diffHunks.length > 0 && (
            <Section>
              <SectionTitle>Diff hunks</SectionTitle>
              {state.diffHunks.map((h, i) => (
                <div key={`${h.path}-${i}`} style={{ marginBottom: 12 }}>
                  <Mono>{h.path}</Mono>
                  <Pre>
                    <HighlightedDiff text={h.hunk} />
                  </Pre>
                </div>
              ))}
            </Section>
          )}

          <Section style={{ borderBottom: 'none' }}>
            <details>
              <Summary>Raw state (JSON)</Summary>
              <SyntaxHighlighter language="json" copyable bordered padded format={false}>
                {JSON.stringify(state, null, 2)}
              </SyntaxHighlighter>
            </details>
          </Section>
        </Body>
      )}
    </Page>
  );
};

// Container — wires the channel + manager api. The agent pushes a review via
// the MCP addon; we cache nothing here, just reflect the latest pushed state.
export const ReviewChangesPage: React.FC = () => {
  const api = useStorybookApi();
  const [state, setState] = useState<ReviewState | null>(null);

  const emit = useChannel({
    [EVENTS.APPLY_REVIEW_STATE]: (next: ReviewState) => setState(next),
  });

  // Late/refreshed tab: ask the server to replay the cached overlay.
  useEffect(() => {
    emit(EVENTS.REQUEST_REVIEW_STATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ReviewChangesView state={state} onClose={() => api.selectFirstStory()} />;
};
