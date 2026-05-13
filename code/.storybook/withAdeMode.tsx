/**
 * When the toolbar global `adeMode === 'on'`, wraps the story in a faux
 * Claude Code app + browser-preview layout so the reviewer can see what
 * the prototype looks like when Claude opens it during an agent
 * session.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  AddIcon,
  BookmarkIcon,
  BranchIcon,
  ChatIcon,
  ChevronDownIcon,
  ChevronSmallDownIcon,
  CircleIcon,
  CloseIcon,
  CommandIcon,
  EditIcon,
  FilterIcon,
  GlobeIcon,
  LightningIcon,
  MenuIcon,
  PlusIcon,
  RefreshIcon,
  ShareAltIcon,
  SideBySideIcon,
  StorybookIcon,
  WandIcon,
} from '@storybook/icons';
import { styled } from 'storybook/theming';

import type { Decorator } from '@storybook/react-vite';

// ────────────────────────────────────────────────────────────────
// Visual constants — driven by CSS variables so the shell can swap
// between a dark and light palette via the toolbar toggle.
// ────────────────────────────────────────────────────────────────

const BG_OUTER = 'var(--ade-bg-outer)';
const PANEL_BG = 'var(--ade-panel-bg)';
const PANEL_BORDER = 'var(--ade-panel-border)';
const SIDEBAR_BG = 'var(--ade-sidebar-bg)';
const TEXT = 'var(--ade-text)';
const TEXT_DIM = 'var(--ade-text-dim)';
const TEXT_FAINT = 'var(--ade-text-faint)';
const ACCENT = 'var(--ade-accent)';
const HOVER = 'var(--ade-hover)';
const BORDER_SOFT = 'var(--ade-border-soft)';
const PILL_BG = 'var(--ade-pill-bg)';
const GREEN = 'var(--ade-green)';
const RED = 'var(--ade-red)';
const ITEM_TEXT = 'var(--ade-item-text)';
const ITEM_BRANCH = 'var(--ade-item-branch)';
const TRANSCRIPT_TEXT = 'var(--ade-transcript-text)';
const LINK = 'var(--ade-link)';
const CODE_BG = 'var(--ade-code-bg)';
const CODE_COLOR = 'var(--ade-code-color)';
const TH = 'var(--ade-th)';
const INPUT_BG = 'var(--ade-input-bg)';
const PR_BG = 'var(--ade-pr-bg)';
const PR_BG_HOVER = 'var(--ade-pr-bg-hover)';
const BROWSER_BG = 'var(--ade-browser-bg)';
const CHROME_BG = 'var(--ade-chrome-bg)';
const URL_BG = 'var(--ade-url-bg)';
const STORY_BG = 'var(--ade-story-bg)';
const RESIZER_GRIP = 'var(--ade-resizer-grip)';
const SHADOW =
  'var(--ade-shadow, 0 30px 60px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.02))';
const GREEN_SOFT = 'var(--ade-green-soft)';
const GREEN_SOFT_BORDER = 'var(--ade-green-soft-border)';
const RED_SOFT = 'var(--ade-red-soft)';
const RED_SOFT_BORDER = 'var(--ade-red-soft-border)';

type AdeMode = 'light' | 'dark';

const PALETTES: Record<AdeMode, Record<string, string>> = {
  dark: {
    '--ade-bg-outer': '#0a0a0a',
    '--ade-panel-bg': '#161616',
    '--ade-panel-border': '#262626',
    '--ade-sidebar-bg': '#141414',
    '--ade-text': '#e6e6e6',
    '--ade-text-dim': '#8a8a8a',
    '--ade-text-faint': '#5a5a5a',
    '--ade-accent': '#cc7a55',
    '--ade-hover': 'rgba(255,255,255,0.04)',
    '--ade-border-soft': '#222222',
    '--ade-pill-bg': '#1f1f1f',
    '--ade-green': '#7fb87f',
    '--ade-red': '#d97a7a',
    '--ade-item-text': '#cfcfcf',
    '--ade-item-branch': '#9aa3b5',
    '--ade-transcript-text': '#d8d8d8',
    '--ade-link': '#7da3e0',
    '--ade-code-bg': '#1d1d1d',
    '--ade-code-color': '#e3c9a3',
    '--ade-th': '#7aa6d6',
    '--ade-input-bg': '#181818',
    '--ade-pr-bg': '#1f1f1f',
    '--ade-pr-bg-hover': '#262626',
    '--ade-browser-bg': '#0e0e0e',
    '--ade-chrome-bg': '#1a1a1a',
    '--ade-url-bg': '#0e0e0e',
    '--ade-story-bg': '#ffffff',
    '--ade-resizer-grip': '#2a2a2a',
    '--ade-shadow':
      '0 30px 60px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.02)',
    '--ade-green-soft': 'rgba(127,184,127,0.12)',
    '--ade-green-soft-border': 'rgba(127,184,127,0.28)',
    '--ade-red-soft': 'rgba(217,122,122,0.12)',
    '--ade-red-soft-border': 'rgba(217,122,122,0.28)',
  },
  light: {
    '--ade-bg-outer': '#f1ede5',
    '--ade-panel-bg': '#ffffff',
    '--ade-panel-border': '#e2ddd0',
    '--ade-sidebar-bg': '#f7f4ec',
    '--ade-text': '#1f1d1a',
    '--ade-text-dim': '#6e6a62',
    '--ade-text-faint': '#a5a094',
    '--ade-accent': '#b85d36',
    '--ade-hover': 'rgba(0,0,0,0.045)',
    '--ade-border-soft': '#e6e1d3',
    '--ade-pill-bg': '#efeae0',
    '--ade-green': '#3f8a3f',
    '--ade-red': '#b94a4a',
    '--ade-item-text': '#3a3833',
    '--ade-item-branch': '#5f6b86',
    '--ade-transcript-text': '#2b2a26',
    '--ade-link': '#2f5bb7',
    '--ade-code-bg': '#f1ece1',
    '--ade-code-color': '#8a4f1e',
    '--ade-th': '#2f5bb7',
    '--ade-input-bg': '#f7f4ec',
    '--ade-pr-bg': '#ffffff',
    '--ade-pr-bg-hover': '#f1ece1',
    '--ade-browser-bg': '#ece8dd',
    '--ade-chrome-bg': '#ece8dd',
    '--ade-url-bg': '#fbfaf5',
    '--ade-story-bg': '#ffffff',
    '--ade-resizer-grip': '#d4cfc1',
    '--ade-shadow':
      '0 20px 40px rgba(60,40,20,0.10), 0 4px 10px rgba(60,40,20,0.06), inset 0 0 0 1px rgba(0,0,0,0.02)',
    '--ade-green-soft': 'rgba(63,138,63,0.14)',
    '--ade-green-soft-border': 'rgba(63,138,63,0.3)',
    '--ade-red-soft': 'rgba(185,74,74,0.12)',
    '--ade-red-soft-border': 'rgba(185,74,74,0.3)',
  },
};

// ────────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────────

// Pinned to the viewport so the host story's `parameters.layout`
// (centered, padded, fullscreen) cannot push the Claude shell around
// — layout is re-applied inside the browser preview frame below.
const Outer = styled.div({
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  background: BG_OUTER,
  position: 'fixed' as const,
  inset: 0,
  padding: 16,
  display: 'flex',
  gap: 0,
  overflow: 'hidden',
  color: TEXT,
  fontSize: 13,
  boxSizing: 'border-box',
  zIndex: 1,
});

const Window = styled.div({
  background: PANEL_BG,
  border: `1px solid ${PANEL_BORDER}`,
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column' as const,
  boxShadow: SHADOW,
  minWidth: 0,
});

const ClaudeWindow = styled(Window)({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '230px 1fr',
  minWidth: 540,
});

// ── Resizer ────────────────────────────────────────────────────────

const ResizerTrack = styled.div({
  width: 16,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'col-resize',
  position: 'relative' as const,
  '&:hover > span, &[data-dragging="true"] > span': {
    background: ACCENT,
    opacity: 1,
  },
});

const ResizerGrip = styled.span({
  width: 4,
  height: 60,
  background: RESIZER_GRIP,
  borderRadius: 3,
  opacity: 0.7,
  transition: 'background 120ms, opacity 120ms',
});

// ── Sidebar ────────────────────────────────────────────────────────

const Sidebar = styled.aside({
  background: SIDEBAR_BG,
  borderRight: `1px solid ${BORDER_SOFT}`,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  padding: '10px 0 8px',
});

const SidebarTop = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px 10px',
});

const IconBtn = styled.button<{ active?: boolean }>(({ active }) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: 'none',
  background: active ? HOVER : 'transparent',
  color: active ? TEXT : TEXT_DIM,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  '&:hover': { background: HOVER, color: TEXT },
}));

const CodeChip = styled.div({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 9px',
  borderRadius: 6,
  background: CODE_BG,
  border: `1px solid ${BORDER_SOFT}`,
  fontSize: 11.5,
  color: TEXT,
  fontWeight: 500,
});

const NavList = styled.div({
  display: 'flex',
  flexDirection: 'column' as const,
  padding: '0 6px',
  gap: 1,
});

const NavRow = styled.button({
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  padding: '6px 8px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  color: TEXT,
  fontSize: 12.5,
  '&:hover': { background: HOVER },
});

const NavIcon = styled.span({
  width: 14,
  display: 'inline-flex',
  justifyContent: 'center',
  color: TEXT_DIM,
  fontSize: 12,
});

const NavCaret = styled.span({
  marginLeft: 'auto',
  color: TEXT_FAINT,
  display: 'inline-flex',
  alignItems: 'center',
});

const SectionLabel = styled.div({
  padding: '14px 14px 6px',
  fontSize: 10.5,
  fontWeight: 600,
  color: TEXT_FAINT,
  letterSpacing: '0.02em',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const SectionRight = styled.span({
  marginLeft: 'auto',
  color: TEXT_FAINT,
  display: 'inline-flex',
});

const Scroll = styled.div({
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column' as const,
});

const ListPad = styled.div({ padding: '0 6px' });

const ItemRow = styled.button<{ active?: boolean }>(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  background: active ? HOVER : 'transparent',
  border: 'none',
  borderRadius: 6,
  padding: '5px 8px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  color: active ? TEXT : ITEM_TEXT,
  fontSize: 12,
  minHeight: 26,
  '&:hover': { background: HOVER },
}));

const ItemIconSlot = styled.span<{ kind?: 'diff' | 'dot' | 'branch' }>(({ kind }) => ({
  width: 14,
  display: 'inline-flex',
  justifyContent: 'center',
  color: kind === 'diff' ? ACCENT : kind === 'branch' ? ITEM_BRANCH : TEXT_DIM,
  flexShrink: 0,
}));

const ItemText = styled.span({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  flex: 1,
});

const UserStrip = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderTop: `1px solid ${BORDER_SOFT}`,
  marginTop: 4,
});

const Avatar = styled.span({
  width: 22,
  height: 22,
  borderRadius: 5,
  background: 'linear-gradient(135deg, #f0c674 0%, #cc7a55 100%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#1a1a1a',
  fontSize: 10,
  fontWeight: 700,
});

const UserName = styled.span({ fontSize: 12, color: TEXT });
const UserMeta = styled.span({ fontSize: 11.5, color: TEXT_DIM });

// ── Main column ───────────────────────────────────────────────────

const Main = styled.section({
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
  background: PANEL_BG,
  minWidth: 0,
});

const MainHeader = styled.div({
  height: 38,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  borderBottom: `1px solid ${BORDER_SOFT}`,
  fontSize: 12,
  flexShrink: 0,
});

const Crumbs = styled.div({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: TEXT,
  overflow: 'hidden',
  whiteSpace: 'nowrap' as const,
  textOverflow: 'ellipsis',
});

const CrumbDim = styled.span({ color: TEXT_DIM });
const CrumbSep = styled.span({ color: TEXT_FAINT });
const HeaderActions = styled.div({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: TEXT_DIM,
});

const Transcript = styled.div({
  flex: 1,
  overflowY: 'auto',
  padding: '16px 22px 10px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
  fontSize: 13,
  lineHeight: 1.55,
  color: TRANSCRIPT_TEXT,
  minHeight: 0,
});

const Para = styled.p({ margin: 0 });

const Link = styled.span({
  color: LINK,
  textDecoration: 'none',
});

const Code = styled.code({
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 12,
  background: CODE_BG,
  border: `1px solid ${BORDER_SOFT}`,
  padding: '1px 5px',
  borderRadius: 4,
  color: CODE_COLOR,
});

const Table = styled.table({
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 12.5,
  margin: '2px 0 4px',
});

const Th = styled.th({
  textAlign: 'left' as const,
  fontWeight: 600,
  color: TH,
  padding: '4px 10px 8px',
  borderBottom: `1px solid ${BORDER_SOFT}`,
});

const Td = styled.td({
  padding: '8px 10px',
  borderBottom: `1px solid ${BORDER_SOFT}`,
  color: TRANSCRIPT_TEXT,
  verticalAlign: 'top' as const,
});

const TdNum = styled(Td)({ color: TEXT_DIM });

const OL = styled.ol({
  margin: 0,
  paddingLeft: 22,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
});

const UL = styled.ul({
  margin: 0,
  paddingLeft: 22,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
});

const TimestampRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: TEXT_FAINT,
  fontSize: 11,
  paddingTop: 4,
});

const StarMark = styled.div({
  color: ACCENT,
  padding: '0 0 6px',
  display: 'inline-flex',
});

// ── PR + input bar ───────────────────────────────────────────────

const Composer = styled.div({
  borderTop: `1px solid ${BORDER_SOFT}`,
  padding: '10px 14px 12px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
  flexShrink: 0,
});

const BranchBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '7px 10px',
  background: INPUT_BG,
  border: `1px solid ${BORDER_SOFT}`,
  borderRadius: 8,
  fontSize: 12,
});

const BranchIconSlot = styled.span({
  color: TEXT_DIM,
  display: 'inline-flex',
});

const BranchPair = styled.span({
  color: TEXT,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11.5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const DiffAdd = styled.span({
  color: GREEN,
  background: GREEN_SOFT,
  border: `1px solid ${GREEN_SOFT_BORDER}`,
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11,
  marginLeft: 'auto',
});

const DiffRem = styled.span({
  color: RED,
  background: RED_SOFT,
  border: `1px solid ${RED_SOFT_BORDER}`,
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  fontSize: 11,
});

const CreatePr = styled.button({
  background: PR_BG,
  border: `1px solid ${PANEL_BORDER}`,
  color: TEXT,
  fontSize: 11.5,
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  '&:hover': { background: PR_BG_HOVER },
});

const InputField = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 12px',
  background: INPUT_BG,
  border: `1px solid ${BORDER_SOFT}`,
  borderRadius: 8,
  fontSize: 12.5,
  color: TEXT_DIM,
});

const InputPrompt = styled.span({ flex: 1 });

const InputEnter = styled.span({
  color: TEXT_FAINT,
  display: 'inline-flex',
});

const ComposerFooter = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11.5,
  color: TEXT_DIM,
  paddingTop: 2,
});

const AutoChip = styled.span({
  background: PILL_BG,
  border: `1px solid ${BORDER_SOFT}`,
  padding: '2px 8px',
  borderRadius: 5,
  color: TEXT,
  fontSize: 11,
});

const FootBtn = styled.button({
  background: 'transparent',
  border: 'none',
  color: TEXT_DIM,
  cursor: 'pointer',
  padding: '2px 4px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  '&:hover': { color: TEXT },
});

const ModelInfo = styled.span({
  marginLeft: 'auto',
  color: TEXT_DIM,
  fontSize: 11,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const Spinner = styled.span({
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: `1.5px solid ${TEXT_FAINT}`,
  borderTopColor: ACCENT,
  display: 'inline-block',
});

// ── Browser window ───────────────────────────────────────────────

const BrowserWindow = styled(Window)({
  background: BROWSER_BG,
  flexShrink: 0,
});

const BrowserChrome = styled.div({
  height: 38,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 12px',
  background: CHROME_BG,
  borderBottom: `1px solid ${BORDER_SOFT}`,
  flexShrink: 0,
});

const UrlPill = styled.div({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 24,
  padding: '0 12px',
  background: URL_BG,
  border: `1px solid ${BORDER_SOFT}`,
  borderRadius: 6,
  color: TEXT,
  fontSize: 12,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  overflow: 'hidden',
});

const ChromeBtn = styled.button({
  background: 'transparent',
  border: 'none',
  color: TEXT_DIM,
  cursor: 'pointer',
  width: 22,
  height: 22,
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': { background: HOVER, color: TEXT },
});

type StoryLayout = 'centered' | 'padded' | 'fullscreen';

const StoryFrame = styled.div<{ layout: StoryLayout }>(({ layout }) => ({
  flex: 1,
  background: STORY_BG,
  overflow: 'auto',
  position: 'relative' as const,
  padding: layout === 'fullscreen' ? 0 : 16,
  display: layout === 'centered' ? 'flex' : 'block',
  alignItems: layout === 'centered' ? 'center' : undefined,
  justifyContent: layout === 'centered' ? 'center' : undefined,
}));

// ────────────────────────────────────────────────────────────────
// Mock content for sidebar
// ────────────────────────────────────────────────────────────────

interface Item {
  text: string;
  kind?: 'diff' | 'dot' | 'branch';
  active?: boolean;
}

const PINNED: Item[] = [
  { text: 'Component review session', kind: 'branch' },
  { text: 'Visual regression triage', kind: 'dot', active: true },
  { text: 'Refactor design tokens', kind: 'dot' },
  { text: 'Audit accessibility issues', kind: 'branch' },
  { text: 'Update changelog draft', kind: 'dot' },
];

const RECENTS: Item[] = [
  { text: 'Investigate flaky test', kind: 'dot' },
  { text: 'Sandbox bootstrap fix', kind: 'dot' },
  { text: 'Theme switcher behavior', kind: 'branch' },
  { text: 'Toolbar icons cleanup', kind: 'dot' },
  { text: 'Docs page table of contents', kind: 'branch' },
  { text: 'CSF indexer perf notes', kind: 'dot' },
  { text: 'Controls panel layout', kind: 'branch' },
  { text: 'Backgrounds preset palette', kind: 'dot' },
  { text: 'Vitest project config', kind: 'branch' },
  { text: 'Addon API draft', kind: 'dot' },
  { text: 'Manager UI tweaks', kind: 'dot' },
];

// ────────────────────────────────────────────────────────────────
// Shell
// ────────────────────────────────────────────────────────────────

interface ShellProps {
  storyTitle: string;
  storyId: string;
  mode: AdeMode;
  layout: StoryLayout;
  children: ReactNode;
}

const DEFAULT_PREVIEW_WIDTH = 480;
const MIN_PREVIEW_WIDTH = 320;
const MIN_LEFT_WIDTH = 540;

function ClaudeShell({ storyTitle, mode, layout, children }: ShellProps) {
  const paletteStyle = useMemo(() => PALETTES[mode] as unknown as React.CSSProperties, [mode]);

  const outerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const padding = 16;
      // Available horizontal area for left + handle + preview
      const totalInner = rect.width - padding * 2;
      const proposed = rect.right - padding - e.clientX;
      const maxPreview = totalInner - MIN_LEFT_WIDTH - 16; // resizer track width
      const clamped = Math.max(MIN_PREVIEW_WIDTH, Math.min(maxPreview, proposed));
      setPreviewWidth(clamped);
    };
    const onUp = () => setDragging(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  return (
    <Outer ref={outerRef} style={paletteStyle} data-ade-mode={mode}>
      <ClaudeWindow>
        <Sidebar>
          <SidebarTop>
            <IconBtn title="Chats">
              <ChatIcon />
            </IconBtn>
            <IconBtn title="Sessions">
              <MenuIcon />
            </IconBtn>
            <CodeChip>
              <SideBySideIcon size={11} />
              <span>Code</span>
            </CodeChip>
          </SidebarTop>

          <NavList>
            <NavRow>
              <NavIcon>
                <PlusIcon />
              </NavIcon>
              <span>New session</span>
            </NavRow>
            <NavRow>
              <NavIcon>
                <LightningIcon />
              </NavIcon>
              <span>Routines</span>
            </NavRow>
            <NavRow>
              <NavIcon>
                <WandIcon />
              </NavIcon>
              <span>Customize</span>
            </NavRow>
            <NavRow>
              <NavIcon>
                <MenuIcon />
              </NavIcon>
              <span>More</span>
              <NavCaret>
                <ChevronSmallDownIcon />
              </NavCaret>
            </NavRow>
          </NavList>

          <SectionLabel>
            Pinned
            <SectionRight>
              <BookmarkIcon />
            </SectionRight>
          </SectionLabel>
          <ListPad>
            {PINNED.map((it, i) => (
              <ItemRow key={`p-${i}`} active={it.active}>
                <ItemIconSlot kind={it.kind}>
                  {it.kind === 'branch' ? <BranchIcon /> : <CircleIcon size={8} />}
                </ItemIconSlot>
                <ItemText>{it.text}</ItemText>
              </ItemRow>
            ))}
          </ListPad>

          <SectionLabel>
            Recents
            <SectionRight>
              <FilterIcon />
            </SectionRight>
          </SectionLabel>
          <Scroll>
            <ListPad>
              {RECENTS.map((it, i) => (
                <ItemRow key={`r-${i}`}>
                  <ItemIconSlot kind={it.kind}>
                    {it.kind === 'branch' ? <BranchIcon /> : <CircleIcon size={8} />}
                  </ItemIconSlot>
                  <ItemText>{it.text}</ItemText>
                </ItemRow>
              ))}
            </ListPad>
          </Scroll>

          <UserStrip>
            <Avatar>A</Avatar>
            <UserName>Agent</UserName>
            <UserMeta>· Pro</UserMeta>
            <span style={{ marginLeft: 'auto', color: TEXT_FAINT, display: 'inline-flex' }}>
              <ChevronSmallDownIcon />
            </span>
          </UserStrip>
        </Sidebar>

        <Main>
          <MainHeader>
            <Crumbs>
              <CrumbDim>storybookjs/storybook</CrumbDim>
              <CrumbSep>/</CrumbSep>
              <span>Reviewing {storyTitle}</span>
              <span style={{ color: TEXT_DIM, display: 'inline-flex' }}>
                <ChevronSmallDownIcon />
              </span>
            </Crumbs>
            <HeaderActions>
              <IconBtn title="Outline">
                <MenuIcon />
              </IconBtn>
              <IconBtn title="Split view">
                <SideBySideIcon />
              </IconBtn>
            </HeaderActions>
          </MainHeader>

          <Transcript>
            <Para>
              Could you create a new <Code>Button</Code> component for me? I'd like it to support
              primary and secondary variants, plus a size prop for small, medium, and large.
            </Para>

            <Para>
              I've created the <Code>Button</Code> component in{' '}
              <Link>src/components/Button.tsx</Link> along with its stories in{' '}
              <Link>src/components/Button.stories.tsx</Link>. The component supports the variants
              and sizes you asked for, and I've added a small <Code>disabled</Code> state as well.
            </Para>

            <Para>I categorized the changes so it's easy to scan before review:</Para>

            <Table>
              <thead>
                <tr>
                  <Th>category</Th>
                  <Th>files</Th>
                  <Th>summary</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>New component</Td>
                  <TdNum>1</TdNum>
                  <Td>
                    <Code>Button.tsx</Code> with variant + size props and styled-component styles
                  </Td>
                </tr>
                <tr>
                  <Td>Stories</Td>
                  <TdNum>1</TdNum>
                  <Td>
                    <Code>Button.stories.tsx</Code> covering Primary, Secondary, Sizes, and Disabled
                  </Td>
                </tr>
                <tr>
                  <Td>Types</Td>
                  <TdNum>1</TdNum>
                  <Td>
                    exported <Code>ButtonProps</Code> for downstream usage
                  </Td>
                </tr>
                <tr>
                  <Td>Index exports</Td>
                  <TdNum>1</TdNum>
                  <Td>re-exported the component from the package barrel</Td>
                </tr>
              </tbody>
            </Table>

            <Para>
              The affected changes can be seen in the browser preview on the right — I've opened the
              stories so you can flip between variants and confirm the visuals match what you had in
              mind.
            </Para>

            <UL>
              <li>
                <Link>http://localhost:6006/?path=/story/components-button--primary</Link> —
                Storybook
              </li>
            </UL>
          </Transcript>

          <Composer>
            <BranchBar>
              <BranchIconSlot>
                <BranchIcon />
              </BranchIconSlot>
              <BranchPair>
                main <span style={{ color: TEXT_FAINT }}>←</span> feature-branch
              </BranchPair>
              <DiffAdd>+1284</DiffAdd>
              <DiffRem>−412</DiffRem>
              <CreatePr>
                Create PR
                <ChevronSmallDownIcon size={10} />
              </CreatePr>
            </BranchBar>

            <InputField>
              <InputPrompt>Type / for commands</InputPrompt>
              <InputEnter>
                <CommandIcon size={11} />
              </InputEnter>
            </InputField>

            <ComposerFooter>
              <AutoChip>Auto</AutoChip>
              <FootBtn>
                <AddIcon />
              </FootBtn>
              <FootBtn>
                <CircleIcon />
              </FootBtn>
              <FootBtn>
                <ChevronSmallDownIcon />
              </FootBtn>
              <ModelInfo>
                Opus 4.7 · High
                <Spinner />
              </ModelInfo>
            </ComposerFooter>
          </Composer>
        </Main>
      </ClaudeWindow>

      <ResizerTrack
        data-dragging={dragging ? 'true' : 'false'}
        onMouseDown={onMouseDown}
        title="Drag to resize preview"
      >
        <ResizerGrip />
      </ResizerTrack>

      <BrowserWindow style={{ width: previewWidth }}>
        <BrowserChrome>
          <UrlPill>
            <span style={{ color: TEXT_DIM, display: 'inline-flex' }}>
              <GlobeIcon size={11} />
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              localhost:6006/
            </span>
          </UrlPill>
          <ChromeBtn title="Edit">
            <EditIcon />
          </ChromeBtn>
          <ChromeBtn title="Split">
            <ChevronDownIcon />
          </ChromeBtn>
          <ChromeBtn title="Reload">
            <RefreshIcon />
          </ChromeBtn>
          <ChromeBtn title="Close">
            <CloseIcon />
          </ChromeBtn>
        </BrowserChrome>
        <StoryFrame layout={layout}>{children}</StoryFrame>
      </BrowserWindow>
    </Outer>
  );
}

/**
 * Storybook decorator. Reads `context.globals.adeMode` (toggled by the
 * toolbar item registered in `.storybook/preview.tsx`). When set to
 * `'light'` or `'dark'`, wraps the story in the Claude shell in that
 * theme; when `undefined` (default), renders the story untouched.
 */
export const withAdeMode: Decorator = (Story, context) => {
  const { adeMode, sb_theme } = context.globals;

  if (!adeMode || sb_theme === 'stacked' || sb_theme === 'side-by-side') {
    return <Story />;
  }

  const mode: AdeMode | null = adeMode === 'on' ? 'dark' : adeMode;
  console.log({ mode });
  if (!mode) return <Story />;
  const storyId = context.id ?? '';
  const storyTitle = `${context.title ?? ''} / ${context.name ?? ''}`;
  // Read the story's own `parameters.layout` and re-apply it inside the
  // browser preview frame, so the outer Claude shell stays flush against
  // the viewport regardless of what the host story requested.
  const rawLayout = context.parameters?.layout;
  const layout: StoryLayout =
    rawLayout === 'fullscreen' || rawLayout === 'centered' ? rawLayout : 'padded';
  return (
    <ClaudeShell storyId={storyId} storyTitle={storyTitle} mode={mode} layout={layout}>
      <Story />
    </ClaudeShell>
  );
};
