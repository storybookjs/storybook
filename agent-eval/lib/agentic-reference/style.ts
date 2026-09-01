// One palette for the agentic-reference CLIs: results:compare styles its
// cell table through `reason`, and eval:plan styles its states through
// `tone`; both go through TONE_COLOR, so the two commands always match.
import { styleText } from 'node:util';

import type { CellReason } from './comparison/cells.ts';

/** What a line means: nothing to do, fixable for free, or costs collection. */
export type Tone = 'good' | 'caution' | 'action';

export interface OutputStyle {
  bold(s: string): string;
  caseName(s: string): string;
  tone(t: Tone, s: string): string;
  /** De-emphasis for parentheticals and other secondary detail. */
  dim(s: string): string;
  reason(r: CellReason, s: string): string;
}

const identity = (s: string) => s;

export const PLAIN_STYLE: OutputStyle = {
  bold: identity,
  caseName: identity,
  tone: (_t, s) => s,
  dim: identity,
  reason: (_r, s) => s,
};

const TONE_COLOR: Record<Tone, 'green' | 'yellow' | 'red'> = {
  good: 'green',
  caution: 'yellow',
  action: 'red',
};

// Green: nothing to do. Yellow: fixable for free by re-running the analyzer.
// Red: needs collecting.
const REASON_TONE: Record<CellReason, Tone> = {
  complete: 'good',
  unanalyzed: 'caution',
  'superseded-runs': 'action',
  'missing-runs': 'action',
};

/**
 * Terminal styling gated on the stream being a real TTY, so piped/redirected
 * output (files, `| cat`, CI logs) stays plain even if NO_COLOR/FORCE_COLOR
 * would otherwise let styleText emit escapes.
 */
export function ansiStyle(stream: { isTTY?: boolean }): OutputStyle {
  if (!stream.isTTY) return PLAIN_STYLE;
  const tone = (t: Tone, s: string) => styleText(TONE_COLOR[t], s);
  return {
    bold: (s) => styleText('bold', s),
    caseName: (s) => styleText('magenta', s),
    tone,
    dim: (s) => styleText(['dim', 'white'], s),
    reason: (r, s) => tone(REASON_TONE[r], s),
  };
}
