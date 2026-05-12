/**
 * Synthetic edit scenarios for the inner-loop agent eval harness.
 *
 * Each scenario describes a deterministic find→replace edit on a known file
 * in the dogfood Storybook UI. Applying the edit triggers change-detection,
 * we read the resulting status snapshot via the addon-before-after probe
 * endpoint, build the proposed `get_change_context` payload, optionally
 * invoke an agent against it, and revert.
 *
 * Edits are visually neutral (won't break the rendered Storybook UI) but
 * substantive enough to change the AST dep set so change-detection fires.
 */

export interface Scenario {
  name: string;
  description: string;
  filePath: string;
  /** Exact substring in the original file. Must be unique. */
  find: string;
  /** Replacement substring. */
  replaceWith: string;
  /** Sanity-check range for `total cascade` against the dogfood. */
  expectedCascade: { min: number; max: number };
  /** Why the scenario exists. */
  hypothesis: string;
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'small',
    description: 'Typical first-party file edit (1-line const rename)',
    filePath: 'code/core/src/manager/components/sidebar/Sidebar.tsx',
    find: `export const DEFAULT_REF_ID = 'storybook_internal';`,
    replaceWith: `export const DEFAULT_REF_ID = 'storybook_internal_eval';`,
    expectedCascade: { min: 50, max: 200 },
    hypothesis: 'Bounded cascade in the manager namespace',
  },
  {
    name: 'medium',
    description: 'Component-tree-wide cascade via Button.tsx',
    filePath: 'code/core/src/components/components/Button/Button.tsx',
    find: `import type { ComponentProps } from 'react';
import React, { forwardRef, useEffect, useMemo, useState } from 'react';`,
    replaceWith: `import type { ComponentProps } from 'react';
// AGENT_EVAL_MARKER
import React, { forwardRef, useEffect, useMemo, useState } from 'react';`,
    expectedCascade: { min: 500, max: 1200 },
    hypothesis: 'Button is widely depended-on; large cascade',
  },
  {
    name: 'large',
    description: 'Worst-case string-aliased shared utility (theming)',
    filePath: 'code/core/src/theming/index.ts',
    find: `import type { StorybookTheme } from './types.ts';`,
    replaceWith: `import type { StorybookTheme } from './types.ts';
const __agentEvalMarker = 'theming_eval';`,
    expectedCascade: { min: 1000, max: 1500 },
    hypothesis: '75%-of-stories cascade because every UI file imports from theming barrel',
  },
  {
    name: 'css-only',
    description: 'CSS file change — change-detection should be blind',
    filePath: 'code/.storybook/bench/bundle-analyzer/index.css',
    find: `  --bg: #fff;`,
    replaceWith: `  --bg: #ff00ff; /* AGENT_EVAL_MARKER */`,
    expectedCascade: { min: 0, max: 5 },
    hypothesis: 'Change-detection is CSS-blind; agent must consume raw diff',
  },
  {
    name: 'regex-aliased',
    description: 'Regex-aliased barrel (storybook/test) — opaque-leaf',
    filePath: 'code/core/src/test/expect.ts',
    find: `/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as matchers from '@testing-library/jest-dom/matchers';`,
    replaceWith: `/* eslint-disable @typescript-eslint/ban-ts-comment */
// AGENT_EVAL_MARKER
import * as matchers from '@testing-library/jest-dom/matchers';`,
    expectedCascade: { min: 0, max: 10 },
    hypothesis: 'storybook/test is regex-aliased; resolver cannot follow → 0 cascade',
  },
];

export function findScenario(name: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}
