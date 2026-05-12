/**
 * Token cost experiment for the proposed `get_change_context` MCP tool.
 *
 * Constructs realistic payloads for two scenarios:
 *   - typical edit (Sidebar.tsx → 110 stories flagged)
 *   - cascade edit  (theming/index.ts → 1,212 stories flagged)
 *
 * Estimates token count using the same fast approximation @storybook/addon-mcp
 * uses internally (see node_modules/@storybook/addon-mcp/dist/preset.js,
 * `estimateTokens` function: counts whitespace runs, alphanumeric runs, and
 * each special char as a token).
 *
 * Run with:
 *   node project-documents/questions/appendix/token-cost-experiment.ts
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const repo = '/Users/yannbraga/open-source/storybook';

// ── Token estimator (fast approximation, mirrors addon-mcp) ───────────────
function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const code = text.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      count++; i++;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (!(c === 32 || c === 9 || c === 10 || c === 13)) break;
        i++;
      }
    } else if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95) {
      count++; i++;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95)) break;
        i++;
      }
    } else {
      count++; i++;
    }
  }
  return count;
}

// ── Build realistic synthetic payloads ────────────────────────────────────
// We don't have a real change-detection-running env, so we construct
// payloads that match what the proposed `get_change_context` tool would return
// based on the empirical numbers measured in INVESTIGATION_FINDINGS §20-21.

interface ChangeContextPayload {
  modified: string[];
  affected: string[];
  new: string[];
  cssAffected: string[];
  rawDiff: { path: string; hunks: string }[];
  projectShape: { totalStories: number; topNamespaces: { name: string; count: number }[] };
  reverseIndexSlice: { changedFile: string; importingStories: string[] }[];
}

function makeStoryIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}--story-${i + 1}`);
}

function makePayload(scenario: 'typical' | 'cascade'): ChangeContextPayload {
  if (scenario === 'typical') {
    // Sidebar.tsx 1-line edit → 110 stories (44 modified + 66 affected)
    return {
      modified: makeStoryIds('manager-sidebar', 44),
      affected: makeStoryIds('manager-main', 66),
      new: [],
      cssAffected: [],
      rawDiff: [{
        path: 'code/core/src/manager/components/sidebar/Sidebar.tsx',
        hunks: `@@ -28,7 +28,7 @@\n import { useLastViewed } from './useLastViewed.ts';\n \n-export const DEFAULT_REF_ID = 'storybook_internal';\n+export const DEFAULT_REF_ID = 'storybook_internal_v2';\n \n const Container = styled.header(({ theme }) => ({`,
      }],
      projectShape: {
        totalStories: 1613,
        topNamespaces: [
          { name: 'addons', count: 658 },
          { name: 'manager', count: 299 },
          { name: 'components', count: 214 },
          { name: 'core', count: 157 },
          { name: 'component-testing', count: 82 },
          { name: 'preview-overlay', count: 75 },
        ],
      },
      reverseIndexSlice: [{
        changedFile: 'code/core/src/manager/components/sidebar/Sidebar.tsx',
        importingStories: makeStoryIds('manager-sidebar', 44).concat(makeStoryIds('manager-main', 66)),
      }],
    };
  }
  // theming/index.ts edit → 1,212 stories (350 modified + 862 affected)
  return {
    modified: makeStoryIds('mod', 350),
    affected: makeStoryIds('aff', 862),
    new: [],
    cssAffected: [],
    rawDiff: [{
      path: 'code/core/src/theming/index.ts',
      hunks: `@@ -1,5 +1,7 @@\n /// <reference path="../typings.d.ts" />\n import type { FunctionInterpolation, Interpolation } from '@emotion/react';\n \n+// EXPERIMENT-MARKER: high-cascade test\n import type { StorybookTheme } from './types.ts';\n+const __experimentMarker = 'storybook_theming_v2';`,
    }],
    projectShape: {
      totalStories: 1613,
      topNamespaces: [
        { name: 'addons', count: 658 },
        { name: 'manager', count: 299 },
        { name: 'components', count: 214 },
        { name: 'core', count: 157 },
        { name: 'component-testing', count: 82 },
        { name: 'preview-overlay', count: 75 },
      ],
    },
    reverseIndexSlice: [{
      changedFile: 'code/core/src/theming/index.ts',
      importingStories: makeStoryIds('mod', 350).concat(makeStoryIds('aff', 862)),
    }],
  };
}

// ── Measure ────────────────────────────────────────────────────────────────
function report(label: string, payload: ChangeContextPayload) {
  const json = JSON.stringify(payload);
  const tokens = estimateTokens(json);
  const idsTotal = payload.modified.length + payload.affected.length + payload.new.length + payload.cssAffected.length;
  const diffChars = payload.rawDiff.reduce((s, d) => s + d.hunks.length, 0);
  console.log(`\n=== ${label} ===`);
  console.log(`  Stories flagged: ${idsTotal}`);
  console.log(`  Raw-diff bytes:  ${diffChars}`);
  console.log(`  Payload JSON:    ${json.length} chars`);
  console.log(`  Estimated tokens: ${tokens} (~${(tokens / 1000).toFixed(1)}K)`);
  console.log(`  Tokens per story: ${(tokens / idsTotal).toFixed(1)}`);

  // What would a typical model context use? 200K context (Sonnet)
  console.log(`  As % of 200K context: ${(tokens / 200000 * 100).toFixed(2)}%`);
}

const typical = makePayload('typical');
const cascade = makePayload('cascade');

report('TYPICAL edit (Sidebar.tsx → 110 stories)', typical);
report('CASCADE edit (theming/index.ts → 1,212 stories)', cascade);

// Worst-case scenario: 5,000-story repo with 60% cascade through real diffs
const worstCase: ChangeContextPayload = {
  modified: makeStoryIds('mod', 1000),
  affected: makeStoryIds('aff', 2000),
  new: makeStoryIds('new', 50),
  cssAffected: makeStoryIds('css', 200),
  rawDiff: Array.from({ length: 8 }, (_, i) => ({
    path: `code/components/Component${i}.tsx`,
    hunks: '@@ -1,50 +1,51 @@\n' + '  example diff line content\n'.repeat(60),
  })),
  projectShape: {
    totalStories: 5000,
    topNamespaces: [
      { name: 'forms', count: 800 },
      { name: 'navigation', count: 600 },
      { name: 'data-display', count: 750 },
      { name: 'feedback', count: 400 },
      { name: 'overlays', count: 350 },
      { name: 'inputs', count: 700 },
    ],
  },
  reverseIndexSlice: Array.from({ length: 8 }, (_, i) => ({
    changedFile: `code/components/Component${i}.tsx`,
    importingStories: makeStoryIds(`comp${i}`, 400),
  })),
};
report('WORST-CASE (5K-story repo, 60% cascade, 8 changed files)', worstCase);

// What if we had to send full source for top-N stories instead of just IDs?
// (This is what would happen if the agent did "filter K from N" without aliases.)
console.log(`\n=== Compare: agent-as-filter approach (sends story source bodies) ===`);
const sampleStorySource = `
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  args: { onClick: fn() },
  argTypes: { variant: { control: 'select', options: ['primary', 'secondary'] } },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', label: 'Primary' } };
export const Secondary: Story = { args: { variant: 'secondary', label: 'Secondary' } };

export const Disabled: Story = {
  args: { variant: 'primary', label: 'Disabled', disabled: true },
  play: async ({ canvas, userEvent }) => {
    const btn = canvas.getByRole('button');
    await userEvent.click(btn);
  },
};
`.trim();

const sourceTokens = estimateTokens(sampleStorySource);
console.log(`  One typical story file: ${sourceTokens} tokens`);
console.log(`  100 story files (filter approach):  ${100 * sourceTokens} tokens (~${(100 * sourceTokens / 1000).toFixed(0)}K)`);
console.log(`  500 story files (filter approach):  ${500 * sourceTokens} tokens (~${(500 * sourceTokens / 1000).toFixed(0)}K)`);
console.log(`  1212 story files (filter approach): ${1212 * sourceTokens} tokens (~${(1212 * sourceTokens / 1000).toFixed(0)}K)`);
console.log(`\n  → Filter approach exceeds 200K context at >${Math.floor(200000 / sourceTokens)} stories.`);
