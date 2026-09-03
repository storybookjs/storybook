import { describe, expect, it } from 'vitest';

import type { Cell } from './cells.ts';
import type { ResolvedCase } from './resolve.ts';
import { cellStatuses, formatCellTable, remediationCommands } from './commands.ts';
import { PLAIN_STYLE, type OutputStyle } from '../style.ts';

/** Distinct, greppable markers (not ANSI) so alignment assertions are deterministic. */
const MARKER_STYLE: OutputStyle = {
  bold: (s) => `[B]${s}[/B]`,
  caseName: (s) => `[C]${s}[/C]`,
  tone: (t, s) => `[T:${t}]${s}[/T]`,
  dim: (s) => `[D]${s}[/D]`,
  reason: (r, s) => `[R:${r}]${s}[/R]`,
};

const DO_DONT: ResolvedCase = {
  caseName: 'cc-do-dont-opus-high',
  experiment: 'agentic-ref-cc-do-dont-opus-high',
  shortName: 'do-dont',
};
const FULL: ResolvedCase = {
  caseName: 'cc-full-opus-high',
  experiment: 'agentic-ref-cc-full-opus-high',
  shortName: 'full',
};

describe('remediationCommands', () => {
  it('groups collection gaps per experiment with workflows comma-joined', () => {
    expect(
      remediationCommands([
        { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
        { case: DO_DONT, workflow: '701-new-ui-flow', have: 3, need: 10, reason: 'missing-runs' },
        { case: FULL, workflow: '701-new-ui-flow', have: 2, need: 10, reason: 'superseded-runs' },
      ])
    ).toEqual([
      'AGENTIC_REF_FLOW=701-new-ui-flow,703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-do-dont-opus-high',
      'AGENTIC_REF_FLOW=701-new-ui-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-full-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-do-dont-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-full-opus-high',
    ]);
  });

  it('emits a plain analyze command for unanalyzed gaps', () => {
    expect(
      remediationCommands([
        { case: FULL, workflow: '703-fix-bug-flow', have: 4, need: 10, reason: 'unanalyzed' },
      ])
    ).toEqual(['yarn results:analyze --experiment=agentic-ref-cc-full-opus-high']);
  });

  it('follows a collection command with an analyze command for the same experiment', () => {
    expect(
      remediationCommands([
        { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
      ])
    ).toEqual([
      'AGENTIC_REF_FLOW=703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-do-dont-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-do-dont-opus-high',
    ]);
  });

  it('collects both workflows in one command when an experiment has missing-runs and superseded-runs gaps', () => {
    expect(
      remediationCommands([
        { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
        {
          case: DO_DONT,
          workflow: '701-new-ui-flow',
          have: 4,
          need: 10,
          reason: 'superseded-runs',
        },
      ])
    ).toEqual([
      'AGENTIC_REF_FLOW=701-new-ui-flow,703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-do-dont-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-do-dont-opus-high',
    ]);
  });

  it('expands a bundled gap into runnable per-constituent commands', () => {
    // 'bundled' is synthetic: the runner would reject it, so the commands
    // must name the real experiments the bundle pools.
    const bundle: ResolvedCase = {
      caseName: 'bundled',
      experiment: 'bundled',
      shortName: 'bundled',
      pooledExperiments: [DO_DONT.experiment, FULL.experiment],
    };
    expect(
      remediationCommands([
        { case: bundle, workflow: '703-fix-bug-flow', have: 1, need: 10, reason: 'missing-runs' },
      ])
    ).toEqual([
      'AGENTIC_REF_FLOW=703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-do-dont-opus-high',
      'AGENTIC_REF_FLOW=703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-full-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-do-dont-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-full-opus-high',
    ]);
  });

  it('pins Math.max: two missing-runs gaps with differing need values collect at the larger need', () => {
    expect(
      remediationCommands([
        { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 3, reason: 'missing-runs' },
        { case: DO_DONT, workflow: '701-new-ui-flow', have: 0, need: 10, reason: 'missing-runs' },
      ])
    ).toEqual([
      'AGENTIC_REF_FLOW=701-new-ui-flow,703-fix-bug-flow AGENTIC_REF_RUNS=10 yarn eval:agentic-ref agentic-ref-cc-do-dont-opus-high',
      'yarn results:analyze --experiment=agentic-ref-cc-do-dont-opus-high',
    ]);
  });
});

describe('cellStatuses', () => {
  function cell(resolvedCase: ResolvedCase, workflow: string, usable: number): Cell {
    return {
      case: resolvedCase,
      workflow,
      runs: Array.from({ length: usable }, (_, i) => ({
        run: {
          runDir: `/results/${resolvedCase.experiment}/t/${workflow}/run-${i + 1}`,
          projectDir: '',
          experiment: resolvedCase.experiment,
          model: '',
          timestamp: 't',
          evalName: workflow,
          run: i + 1,
          collected: true,
        },
        analysis: {},
      })),
      excluded: [],
      unanalyzed: 0,
      superseded: 0,
      passed: usable,
      failed: 0,
    };
  }

  it('lists every cell in cell order: gaps as themselves, the rest as complete', () => {
    const cells = [cell(DO_DONT, '701-new-ui-flow', 12), cell(FULL, '701-new-ui-flow', 4)];
    const gap = {
      case: FULL,
      workflow: '701-new-ui-flow',
      have: 4,
      need: 10,
      reason: 'missing-runs' as const,
    };
    expect(cellStatuses(cells, [gap], 10)).toEqual([
      { case: DO_DONT, workflow: '701-new-ui-flow', have: 12, need: 10, reason: 'complete' },
      gap,
    ]);
  });
});

describe('formatCellTable', () => {
  it('renders a complete cell with its full count and a complete reason', () => {
    const table = formatCellTable(
      [
        { case: DO_DONT, workflow: '701-new-ui-flow', have: 12, need: 10, reason: 'complete' },
        { case: FULL, workflow: '701-new-ui-flow', have: 4, need: 10, reason: 'missing-runs' },
      ],
      MARKER_STYLE
    );
    expect(table).toContain('12/10');
    expect(table).toContain('[R:complete]complete[/R]');
  });
  it('renders one aligned line per gap', () => {
    const table = formatCellTable([
      { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
    ]);
    expect(table).toContain('case');
    expect(table).toContain('do-dont');
    expect(table).toContain('0/10');
    expect(table).toContain('missing-runs');
  });

  it('defaults to PLAIN_STYLE, so an unstyled call matches an explicit one', () => {
    const gaps = [
      { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
      { case: FULL, workflow: '701-new-ui-flow', have: 4, need: 10, reason: 'unanalyzed' },
    ] as const;
    expect(formatCellTable([...gaps])).toBe(formatCellTable([...gaps], PLAIN_STYLE));
  });

  it('bolds the header row, wraps case and reason cells, and preserves column alignment', () => {
    const gaps = [
      { case: DO_DONT, workflow: '703-fix-bug-flow', have: 0, need: 10, reason: 'missing-runs' },
      { case: FULL, workflow: '701-new-ui-flow', have: 4, need: 10, reason: 'unanalyzed' },
    ] as const;
    const plain = formatCellTable([...gaps]);
    const styled = formatCellTable([...gaps], MARKER_STYLE);

    // Stripping every marker recovers exactly the plain table: styling never
    // disturbs the column widths computed from plain text.
    const stripped = styled.replace(/\[\/?[A-Z](?::[a-z-]+)?\]/g, '');
    expect(stripped).toBe(plain);

    const [header, doDontRow, fullRow] = styled.split('\n');
    // Header: every cell individually bolded, not one wrap around the whole line.
    expect(header).toMatch(
      /^\[B\]case\s*\[\/B\]  \[B\]workflow\s*\[\/B\]  \[B\]runs\[\/B\]  \[B\]reason\[\/B\]$/
    );
    // Data rows: case cell wrapped, workflow/runs cells left plain, reason cell
    // wrapped with the gap's own reason (not the header's).
    expect(doDontRow).toMatch(
      /^\[C\]do-dont\s*\[\/C\]  703-fix-bug-flow\s*  0\/10\s*  \[R:missing-runs\]missing-runs\[\/R\]$/
    );
    expect(fullRow).toMatch(
      /^\[C\]full\s*\[\/C\]  701-new-ui-flow\s*  4\/10\s*  \[R:unanalyzed\]unanalyzed\[\/R\]$/
    );
  });
});
