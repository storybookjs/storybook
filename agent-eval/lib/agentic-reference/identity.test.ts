import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canonicalPin,
  currentMeasurement,
  describeDifferences,
  measurementDifferences,
  measurementKey,
  readRunMeasurement,
} from './identity.ts';

import type { Measurement } from './identity.ts';

function measurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    experiment: 'agentic-ref-cc-full-opus-high',
    evalName: '701-new-ui-flow',
    model: 'opus',
    pin: 'yannbf/mealdrop@droppy-70pc',
    mcp: 'yannbf/droppy-ds#experiment/full',
    editedPrompt: true,
    provider: 'ai-gateway',
    task: 'abc123',
    ...overrides,
  };
}

describe('canonicalPin', () => {
  it('names a pin by its repo and ref', () => {
    expect(
      canonicalPin({ repo: 'yannbf/mealdrop', ref: 'refs/tags/agentic-reference/droppy-v2' })
    ).toBe('yannbf/mealdrop@droppy-v2');
  });

  // The bundle exists so a re-tag of one tree does not read as a new one.
  it('collapses bundled refs onto one label', () => {
    const v2 = canonicalPin({
      repo: 'yannbf/mealdrop',
      ref: 'refs/tags/agentic-reference/droppy-70pc-v2',
    });
    const v4 = canonicalPin({
      repo: 'yannbf/mealdrop',
      ref: 'refs/tags/agentic-reference/droppy-70pc-v4',
    });
    expect(v2).toBe(v4);
    expect(v2).toBe('yannbf/mealdrop@droppy-70pc');
  });

  it('bundles only within the repo the bundle names', () => {
    expect(
      canonicalPin({ repo: 'someone/else', ref: 'refs/tags/agentic-reference/droppy-70pc-v2' })
    ).toBe('someone/else@droppy-70pc-v2');
  });

  it('reads a missing pin as unknown', () => {
    expect(canonicalPin(null)).toBe('unknown');
  });
});

describe('measurementKey', () => {
  it('is equal for measurements of the same thing', () => {
    expect(measurementKey(measurement())).toBe(measurementKey(measurement()));
  });

  it('differs when any component differs', () => {
    const base = measurementKey(measurement());
    expect(measurementKey(measurement({ pin: 'yannbf/mealdrop@base-ui-v1' }))).not.toBe(base);
    expect(measurementKey(measurement({ mcp: 'none' }))).not.toBe(base);
    expect(measurementKey(measurement({ model: 'sonnet' }))).not.toBe(base);
    expect(measurementKey(measurement({ task: 'def456' }))).not.toBe(base);
    expect(measurementKey(measurement({ editedPrompt: false }))).not.toBe(base);
    expect(measurementKey(measurement({ provider: 'anthropic' }))).not.toBe(base);
  });
});

describe('measurementDifferences', () => {
  it('finds nothing between two measurements of the same thing', () => {
    expect(measurementDifferences(measurement(), measurement())).toEqual([]);
  });

  it('names each component that moved, with both sides', () => {
    expect(
      measurementDifferences(
        measurement({ pin: 'yannbf/mealdrop@droppy-v2', task: 'old' }),
        measurement()
      )
    ).toEqual([
      { field: 'pin', was: 'yannbf/mealdrop@droppy-v2', now: 'yannbf/mealdrop@droppy-70pc' },
      { field: 'task', was: 'old', now: 'abc123' },
    ]);
  });

  it('reads as a sentence', () => {
    expect(
      describeDifferences(
        measurementDifferences(measurement({ mcp: 'none', editedPrompt: false }), measurement())
      )
    ).toBe('mcp: none → yannbf/droppy-ds#experiment/full; editedPrompt: false → true');
  });

  // A provider flip is a real supersession: gateway-served cost figures are
  // not comparable with direct-API ones.
  it('treats a provider change as a moved component', () => {
    expect(measurementDifferences(measurement({ provider: 'unknown' }), measurement())).toEqual([
      { field: 'provider', was: 'unknown', now: 'ai-gateway' },
    ]);
  });
});

describe('readRunMeasurement', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'identity-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeRun(result: unknown, files: Record<string, string> = {}): string {
    const dir = join(root, 'run-1');
    mkdirSync(join(dir, 'project'), { recursive: true });
    writeFileSync(join(dir, 'result.json'), JSON.stringify(result));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, 'project', name), content);
    }
    return dir;
  }

  const RESULT = {
    model: 'opus',
    analysis: {
      provider: 'ai-gateway',
      externalRepo: { repo: 'yannbf/mealdrop', ref: 'refs/tags/agentic-reference/droppy-70pc-v4' },
      case: {
        name: 'cc-full-opus-high',
        integration: 'mcp',
        storybookMcpPackage: {
          repo: 'yannbf/droppy-ds',
          packageName: '@droppy/mcp',
          branch: 'experiment/full',
        },
        editPrompt: true,
      },
    },
  };

  // Everything that decides what a run measured is in the run's own artifacts,
  // which is what makes historical runs identifiable at all.
  it('reads what the run itself recorded', () => {
    const dir = writeRun(RESULT, { 'PROMPT.md': 'do the thing', 'EVAL.ts': 'assert()' });
    expect(
      readRunMeasurement(dir, { experiment: 'agentic-ref-cc-full-opus-high', evalName: '701' })
    ).toMatchObject({
      experiment: 'agentic-ref-cc-full-opus-high',
      evalName: '701',
      model: 'opus',
      pin: 'yannbf/mealdrop@droppy-70pc',
      mcp: 'yannbf/droppy-ds#experiment/full',
      editedPrompt: true,
      provider: 'ai-gateway',
    });
  });

  // Runs from before provider recording say nothing about how they reached
  // the model; `unknown` never matches a real provider, so they read as
  // superseded until backfilled.
  it('reads a run that recorded no provider as unknown', () => {
    const { analysis } = RESULT;
    const dir = writeRun({
      model: 'opus',
      analysis: { externalRepo: analysis.externalRepo, case: analysis.case },
    });
    expect(readRunMeasurement(dir, { experiment: 'x', evalName: '701' })?.provider).toBe('unknown');
  });

  it('digests the task from the prompt and the assertions the run was given', () => {
    const one = readRunMeasurement(
      writeRun(RESULT, { 'PROMPT.md': 'do the thing', 'EVAL.ts': 'assert()' }),
      { experiment: 'x', evalName: '701' }
    );
    rmSync(join(root, 'run-1'), { recursive: true });
    const two = readRunMeasurement(
      writeRun(RESULT, { 'PROMPT.md': 'do the other thing', 'EVAL.ts': 'assert()' }),
      { experiment: 'x', evalName: '701' }
    );
    expect(one?.task).not.toBe(two?.task);
  });

  it('reads an arm that served no MCP as serving none', () => {
    const dir = writeRun({
      model: 'opus',
      analysis: { externalRepo: RESULT.analysis.externalRepo, case: { integration: 'none' } },
    });
    expect(readRunMeasurement(dir, { experiment: 'x', evalName: '701' })?.mcp).toBe('none');
  });

  it('returns null for a run with no readable result', () => {
    mkdirSync(join(root, 'run-2'));
    expect(
      readRunMeasurement(join(root, 'run-2'), { experiment: 'x', evalName: '701' })
    ).toBeNull();
  });
});

describe('currentMeasurement', () => {
  it('describes what an arm measures today, from the registry and the fixture', () => {
    expect(currentMeasurement('agentic-ref-cc-full-opus-high', '701-new-ui-flow')).toMatchObject({
      experiment: 'agentic-ref-cc-full-opus-high',
      evalName: '701-new-ui-flow',
      model: 'opus',
      mcp: 'yannbf/droppy-ds#experiment/full',
      editedPrompt: true,
      provider: 'anthropic',
    });
  });

  // Results outlive the arms and evals that produced them.
  it('has nothing to say about an arm or eval that is gone', () => {
    expect(currentMeasurement('agentic-ref-gone', '701-new-ui-flow')).toBeNull();
    expect(currentMeasurement('agentic-ref-cc-full-opus-high', 'gone')).toBeNull();
  });
});
