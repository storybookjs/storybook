/**
 * `withAdeMode` decorator + Claude-Code-shaped shell.
 *
 * When the toolbar global `adeMode === 'on'`, wraps the story in a faux
 * Claude Code chat-panel + browser-preview layout so the reviewer can
 * see what the prototype looks like when Claude opens it during an
 * agent session.
 *
 * Toggle is registered in `.storybook/preview.tsx` as a global
 * `adeMode` with a toolbar item; the decorator reads it from
 * `context.globals`.
 */
import React, { useMemo, type ReactNode } from 'react';

import { styled } from 'storybook/theming';

import type { Decorator } from '@storybook/react-vite';

// ────────────────────────────────────────────────────────────────
// Claude Code visual constants
// ────────────────────────────────────────────────────────────────

const CLAUDE_BG = '#1a1714';
const CLAUDE_PANEL = '#221d18';
const CLAUDE_BORDER = '#3a342c';
const CLAUDE_TEXT = '#e8e4dd';
const CLAUDE_DIM = '#a8a39a';
const CLAUDE_ACCENT = '#cc785c'; // Anthropic's orange/clay
const CLAUDE_USER = '#5b8ad9'; // user message accent
const CLAUDE_TOOL = '#806550';

// ────────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────────

const Shell = styled.div({
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  background: CLAUDE_BG,
  color: CLAUDE_TEXT,
  width: '100vw',
  height: '100vh',
  display: 'grid',
  gridTemplateRows: '36px 1fr',
  // App rail (56px) · Conversations history (240px) · Active chat (360px) · Preview (1fr)
  gridTemplateColumns: '56px 240px 360px 1fr',
  gridTemplateAreas: `
    "header header header header"
    "rail history chat preview"
  `,
  overflow: 'hidden',
  fontSize: 13,
});

const Header = styled.div({
  gridArea: 'header',
  background: '#0f0d0a',
  borderBottom: `1px solid ${CLAUDE_BORDER}`,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 14px',
  fontSize: 12,
  color: CLAUDE_DIM,
});

const Logo = styled.span({
  color: CLAUDE_ACCENT,
  fontWeight: 700,
  letterSpacing: '0.04em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const HeaderSep = styled.span({
  color: '#4a4239',
  fontSize: 10,
});

const HeaderItem = styled.span({
  color: CLAUDE_TEXT,
});

const HeaderRight = styled.span({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 11,
  color: CLAUDE_DIM,
});

// ── App rail (icon nav) ────────────────────────────────────────────

const AppRail = styled.nav({
  gridArea: 'rail',
  background: '#13100d',
  borderRight: `1px solid ${CLAUDE_BORDER}`,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  padding: '14px 0',
  gap: 6,
});

const RailIcon = styled.button<{ active?: boolean }>(({ active }) => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  border: 'none',
  background: active ? 'rgba(204,120,92,0.18)' : 'transparent',
  color: active ? CLAUDE_ACCENT : CLAUDE_DIM,
  cursor: 'pointer',
  fontSize: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    background: 'rgba(255,255,255,0.05)',
    color: CLAUDE_TEXT,
  },
}));

const RailSpacer = styled.span({ flex: 1 });

const Avatar = styled.span({
  width: 30,
  height: 30,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #cc785c 0%, #806550 100%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  border: `1px solid ${CLAUDE_BORDER}`,
});

// ── Conversation history sidebar ────────────────────────────────────

const History = styled.aside({
  gridArea: 'history',
  background: '#1d1814',
  borderRight: `1px solid ${CLAUDE_BORDER}`,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
});

const HistoryHead = styled.div({
  padding: '10px 12px',
  borderBottom: `1px solid ${CLAUDE_BORDER}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
});

const NewChatBtn = styled.button({
  flex: 1,
  background: 'transparent',
  border: `1px dashed ${CLAUDE_BORDER}`,
  color: CLAUDE_ACCENT,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  '&:hover': { background: 'rgba(204,120,92,0.08)' },
});

const SearchInput = styled.div({
  padding: '8px 12px',
  borderBottom: `1px solid ${CLAUDE_BORDER}`,
});

const SearchField = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: '#13100d',
  border: `1px solid ${CLAUDE_BORDER}`,
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 11.5,
  color: CLAUDE_DIM,
});

const HistoryScroll = styled.div({
  flex: 1,
  overflowY: 'auto',
  padding: '8px 6px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
});

const HistorySection = styled.div({
  padding: '8px 8px 4px',
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  fontWeight: 700,
  color: CLAUDE_DIM,
});

const HistoryItem = styled.button<{ active?: boolean }>(({ active }) => ({
  width: '100%',
  background: active ? 'rgba(204,120,92,0.12)' : 'transparent',
  border: 'none',
  borderRadius: 6,
  padding: '7px 8px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
  color: active ? CLAUDE_TEXT : '#d6cfc4',
  borderLeft: active ? `2px solid ${CLAUDE_ACCENT}` : '2px solid transparent',
  '&:hover': { background: 'rgba(255,255,255,0.04)' },
}));

const HistoryTitle = styled.span({
  fontSize: 12,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const ActiveDot = styled.span({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: CLAUDE_ACCENT,
  flexShrink: 0,
});

const HistoryMeta = styled.span({
  fontSize: 10.5,
  color: CLAUDE_DIM,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
});

// ── Chat panel ────────────────────────────────────────────────────

const Chat = styled.aside({
  gridArea: 'chat',
  background: CLAUDE_PANEL,
  borderRight: `1px solid ${CLAUDE_BORDER}`,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
});

const ChatScroll = styled.div({
  flex: 1,
  overflowY: 'auto',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
});

const Bubble = styled.div<{ role: 'user' | 'assistant' | 'system' }>(({ role }) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  fontSize: 12.5,
  lineHeight: 1.45,
  alignItems: role === 'user' ? 'flex-end' : 'flex-start',
}));

const RoleLabel = styled.span<{ role: 'user' | 'assistant' | 'system' }>(({ role }) => ({
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  fontWeight: 700,
  color: role === 'user' ? CLAUDE_USER : role === 'system' ? CLAUDE_DIM : CLAUDE_ACCENT,
}));

const BubbleBody = styled.div<{ role: 'user' | 'assistant' | 'system' }>(({ role }) => ({
  background: role === 'user' ? 'rgba(91,138,217,0.12)' : 'transparent',
  border: role === 'user' ? `1px solid rgba(91,138,217,0.35)` : 'none',
  borderRadius: 6,
  padding: role === 'user' ? '6px 10px' : '0',
  color: CLAUDE_TEXT,
  maxWidth: '94%',
  whiteSpace: 'pre-wrap' as const,
}));

const ToolCall = styled.div({
  marginTop: 4,
  border: `1px solid ${CLAUDE_BORDER}`,
  borderRadius: 6,
  padding: '6px 9px',
  background: '#1d1814',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11.5,
  color: '#d6cfc4',
  width: '100%',
});

const ToolHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: CLAUDE_TOOL,
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
});

const ToolBody = styled.pre({
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
  color: '#c5beb1',
  fontSize: 11.5,
  lineHeight: 1.4,
});

const InputBar = styled.div({
  borderTop: `1px solid ${CLAUDE_BORDER}`,
  padding: '8px 10px 10px',
  background: '#1a1612',
});

const FakeInput = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: `1px solid ${CLAUDE_BORDER}`,
  borderRadius: 6,
  padding: '8px 10px',
  background: '#13100d',
  color: CLAUDE_DIM,
  fontSize: 12,
});

const Caret = styled.span({
  display: 'inline-block',
  width: 7,
  height: 13,
  background: CLAUDE_ACCENT,
  marginLeft: 2,
  animation: 'adeBlink 1s steps(2) infinite',
  '@keyframes adeBlink': {
    '0%, 50%': { opacity: 1 },
    '50.01%, 100%': { opacity: 0 },
  },
});

const ModelChip = styled.span({
  marginLeft: 'auto',
  fontSize: 10.5,
  color: CLAUDE_DIM,
  background: '#0f0d0a',
  border: `1px solid ${CLAUDE_BORDER}`,
  padding: '2px 7px',
  borderRadius: 999,
});

// ── Preview pane (faux browser) ───────────────────────────────────

const Preview = styled.section({
  gridArea: 'preview',
  background: '#0f0d0a',
  padding: 12,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
});

const Browser = styled.div({
  flex: 1,
  borderRadius: 8,
  border: `1px solid ${CLAUDE_BORDER}`,
  background: '#ffffff',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  boxShadow: '0 12px 32px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)',
});

const Chrome = styled.div({
  height: 36,
  background: '#272320',
  borderBottom: `1px solid #1a1612`,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 12px',
  flexShrink: 0,
});

const Lights = styled.div({
  display: 'flex',
  gap: 6,
  flexShrink: 0,
});

const Light = styled.span<{ color: string }>(({ color }) => ({
  width: 11,
  height: 11,
  borderRadius: '50%',
  background: color,
  display: 'inline-block',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)',
}));

const NavBtns = styled.div({
  display: 'flex',
  gap: 4,
  marginLeft: 6,
  color: '#a8a39a',
  fontSize: 13,
});

const NavBtn = styled.button({
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 3,
  fontSize: 12,
  '&:hover': { background: 'rgba(255,255,255,0.06)' },
  '&:disabled': { opacity: 0.35 },
});

const UrlBar = styled.div({
  flex: 1,
  height: 22,
  background: '#1a1612',
  border: '1px solid #3a342c',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  color: '#d6cfc4',
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11,
  overflow: 'hidden',
});

const Lock = styled.span({
  color: '#7fb87f',
  fontSize: 10,
});

const Reload = styled.button({
  background: 'transparent',
  border: 'none',
  color: '#a8a39a',
  cursor: 'pointer',
  fontSize: 12,
  marginLeft: 4,
  padding: '2px 4px',
  borderRadius: 3,
  '&:hover': { background: 'rgba(255,255,255,0.06)' },
});

const ViewBody = styled.div({
  flex: 1,
  position: 'relative' as const,
  overflow: 'hidden',
  background: '#ffffff',
});

// ── Mock chat content ──────────────────────────────────────────────

interface BubbleSpec {
  role: 'user' | 'assistant' | 'system';
  text?: string;
  tool?: { name: string; body: string };
}

function mockMessages(storyTitle: string): BubbleSpec[] {
  return [
    {
      role: 'user',
      text: `I touched Button.tsx and added a comment marker. Can you check what stories that might affect and open the review page?`,
    },
    {
      role: 'assistant',
      text: `I'll start by looking at the diff to understand what changed, then call the change-detection tool to see which stories are flagged.`,
    },
    {
      role: 'assistant',
      tool: {
        name: 'Bash · git diff --stat',
        body: ' code/core/src/components/components/Button/Button.tsx | 1 +\n 1 file changed, 1 insertion(+)',
      },
    },
    {
      role: 'assistant',
      tool: {
        name: 'mcp · get-changed-stories',
        body: 'Detected 17 changed stories (0 new, 6 modified, 11 related).\n\nModified stories:\n- `button-component--base`: button/component / Base\n- `button-component--variants`: button/component / Variants\n- …',
      },
    },
    {
      role: 'assistant',
      text: `Good — 17 stories across 6 clusters. The change is comment-only so I expect them all to be visually identical, but the agent layer should still surface them for you to skim. Opening the review page now.`,
    },
    {
      role: 'assistant',
      tool: {
        name: 'mcp · open-review-page',
        body: `{ "reviewSlug": "rv_4kx2", "storyIds": [17 ids] }`,
      },
    },
    {
      role: 'assistant',
      text: `Review page is open in the preview pane on the right (currently showing **${storyTitle}**). Use the rail to walk the clusters. I'll wait here for your verdict.`,
    },
    { role: 'system', text: '— agent is idle, waiting for input —' },
  ];
}

// ────────────────────────────────────────────────────────────────
// Decorator
// ────────────────────────────────────────────────────────────────

interface ClaudeShellProps {
  storyTitle: string;
  storyId: string;
  children: ReactNode;
}

interface Conversation {
  title: string;
  meta: string;
  active?: boolean;
  section: 'today' | 'yesterday' | 'last-week';
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    title: 'Reviewing Button.tsx changes',
    meta: 'just now · 17 files · 24 messages',
    active: true,
    section: 'today',
  },
  { title: 'addon-mcp: get-changed-stories', meta: '2h ago · 6 messages', section: 'today' },
  { title: 'Hook up `apply_review_status`', meta: '5h ago · 12 messages', section: 'today' },
  { title: 'StatusStore race condition', meta: 'yesterday · 31 messages', section: 'yesterday' },
  { title: 'Iframe pool memory ceiling', meta: 'yesterday · 9 messages', section: 'yesterday' },
  {
    title: 'env=before iframe correctness',
    meta: '2 days ago · 14 messages',
    section: 'last-week',
  },
  { title: 'CSS-blast prototype', meta: '3 days ago · 7 messages', section: 'last-week' },
  {
    title: 'Round-2 module-graph experiment',
    meta: '4 days ago · 22 messages',
    section: 'last-week',
  },
  { title: 'Real-commit replay design', meta: '5 days ago · 18 messages', section: 'last-week' },
];

function ClaudeShell({ storyTitle, storyId, children }: ClaudeShellProps) {
  const messages = useMemo(() => mockMessages(storyTitle), [storyTitle]);
  const byCol = useMemo(() => {
    const out: Record<Conversation['section'], Conversation[]> = {
      today: [],
      yesterday: [],
      'last-week': [],
    };
    for (const c of MOCK_CONVERSATIONS) out[c.section].push(c);
    return out;
  }, []);
  return (
    <Shell>
      <Header>
        <Logo>✻ Claude</Logo>
        <HeaderSep>·</HeaderSep>
        <HeaderItem>storybookjs/storybook</HeaderItem>
        <HeaderSep>·</HeaderSep>
        <HeaderItem>yann/story-review-analysis</HeaderItem>
        <HeaderRight>
          <span>Context 84.3K / 200K</span>
          <ModelChip>claude-sonnet-4-6</ModelChip>
        </HeaderRight>
      </Header>

      <AppRail>
        <RailIcon active title="Chats">
          💬
        </RailIcon>
        <RailIcon title="Projects">📁</RailIcon>
        <RailIcon title="Files">📄</RailIcon>
        <RailIcon title="Bookmarks">⭐</RailIcon>
        <RailSpacer />
        <RailIcon title="Settings">⚙</RailIcon>
        <Avatar>YB</Avatar>
      </AppRail>

      <History>
        <HistoryHead>
          <NewChatBtn>＋ New chat</NewChatBtn>
        </HistoryHead>
        <SearchInput>
          <SearchField>
            <span>🔍</span>
            <span style={{ flex: 1 }}>Search conversations…</span>
            <span style={{ opacity: 0.5 }}>⌘K</span>
          </SearchField>
        </SearchInput>
        <HistoryScroll>
          <HistorySection>Today</HistorySection>
          {byCol.today.map((c) => (
            <HistoryItem key={c.title} active={c.active}>
              <HistoryTitle>
                {c.active && <ActiveDot />}
                {c.title}
              </HistoryTitle>
              <HistoryMeta>{c.meta}</HistoryMeta>
            </HistoryItem>
          ))}
          <HistorySection>Yesterday</HistorySection>
          {byCol.yesterday.map((c) => (
            <HistoryItem key={c.title}>
              <HistoryTitle>{c.title}</HistoryTitle>
              <HistoryMeta>{c.meta}</HistoryMeta>
            </HistoryItem>
          ))}
          <HistorySection>Last 7 days</HistorySection>
          {byCol['last-week'].map((c) => (
            <HistoryItem key={c.title}>
              <HistoryTitle>{c.title}</HistoryTitle>
              <HistoryMeta>{c.meta}</HistoryMeta>
            </HistoryItem>
          ))}
        </HistoryScroll>
      </History>

      <Chat>
        <ChatScroll>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role}>
              <RoleLabel role={m.role}>
                {m.role === 'user' ? 'you' : m.role === 'system' ? 'system' : '✻ claude'}
              </RoleLabel>
              {m.text && <BubbleBody role={m.role}>{m.text}</BubbleBody>}
              {m.tool && (
                <ToolCall>
                  <ToolHeader>⚙ {m.tool.name}</ToolHeader>
                  <ToolBody>{m.tool.body}</ToolBody>
                </ToolCall>
              )}
            </Bubble>
          ))}
        </ChatScroll>
        <InputBar>
          <FakeInput>
            <span>›</span>
            <span style={{ flex: 1 }}>Continue the conversation…</span>
            <Caret />
          </FakeInput>
        </InputBar>
      </Chat>

      <Preview>
        <Browser>
          <Chrome>
            <Lights>
              <Light color="#ff5f57" />
              <Light color="#febc2e" />
              <Light color="#28c840" />
            </Lights>
            <NavBtns>
              <NavBtn disabled>←</NavBtn>
              <NavBtn disabled>→</NavBtn>
            </NavBtns>
            <Reload>↻</Reload>
            <UrlBar>
              <Lock>🔒</Lock>
              <span>localhost:6006/review/rv_4kx2</span>
              <span style={{ marginLeft: 'auto', opacity: 0.5 }}>· story={storyId}</span>
            </UrlBar>
          </Chrome>
          <ViewBody>{children}</ViewBody>
        </Browser>
      </Preview>
    </Shell>
  );
}

/**
 * Storybook decorator. Reads `context.globals.adeMode` (toggled by the
 * toolbar item registered in `.storybook/preview.tsx`). When 'on',
 * wraps the story in the Claude shell; otherwise renders the story
 * untouched.
 */
export const withAdeMode: Decorator = (Story, context) => {
  const adeMode = (context.globals as Record<string, unknown> | undefined)?.adeMode;
  if (adeMode !== 'on') return <Story />;
  const storyId = context.id ?? '';
  const storyTitle = `${context.title ?? ''} / ${context.name ?? ''}`;
  return (
    <ClaudeShell storyId={storyId} storyTitle={storyTitle}>
      <Story />
    </ClaudeShell>
  );
};
