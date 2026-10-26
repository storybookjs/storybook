import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AGENT_EVAL_ROOT } from './constants.ts';
import { laterSince, loadPlanConfig, resolvePlanFlag, resolvePlanPath } from './plan-config.ts';

describe('resolvePlanPath', () => {
  it('expands a bare plan name into plans/<name>.plan.ts under the repo', () => {
    expect(resolvePlanPath('1-levels-edit')).toBe(
      join(AGENT_EVAL_ROOT, 'plans', '1-levels-edit.plan.ts')
    );
  });

  it('resolves a relative path against the repo root', () => {
    expect(resolvePlanPath('plans/1-levels-edit.plan.ts')).toBe(
      join(AGENT_EVAL_ROOT, 'plans', '1-levels-edit.plan.ts')
    );
  });

  it('keeps an absolute path as it is', () => {
    expect(resolvePlanPath('/elsewhere/custom.plan.ts')).toBe('/elsewhere/custom.plan.ts');
  });
});

describe('loadPlanConfig', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plan-config-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loads the default-exported plan', async () => {
    const path = join(root, 'ok.plan.ts');
    writeFileSync(
      path,
      "export default { experiments: ['a'], evals: ['701'], runs: 2, parallelMax: 4 };\n"
    );
    await expect(loadPlanConfig(path)).resolves.toMatchObject({ runs: 2, parallelMax: 4 });
  });

  it('rejects a missing config by path', async () => {
    await expect(loadPlanConfig(join(root, 'gone.plan.ts'))).rejects.toThrow(/gone\.plan\.ts/);
  });

  it('rejects a module that does not default-export an object', async () => {
    const path = join(root, 'bad.plan.ts');
    writeFileSync(path, 'export const nope = 1;\n');
    await expect(loadPlanConfig(path)).rejects.toThrow(/must default-export a RunPlan/);
  });
});

describe('resolvePlanFlag', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plan-config-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns null when no --plan flag was given', async () => {
    await expect(
      resolvePlanFlag(
        { plan: undefined, experiments: [], evals: [] },
        { experiments: ['a'], evals: ['701'] },
        '--experiments/--evals'
      )
    ).resolves.toBeNull();
  });

  it('resolves the plan into its experiments and evals', async () => {
    const path = join(root, 'ok.plan.ts');
    writeFileSync(
      path,
      "export default { experiments: ['a'], evals: ['701'], runs: 2, parallelMax: 4 };\n"
    );
    const resolved = await resolvePlanFlag(
      { plan: path, experiments: [], evals: [] },
      { experiments: ['a'], evals: ['701'] },
      '--experiments/--evals'
    );
    expect(resolved).toMatchObject({ experiments: ['a'], evals: ['701'] });
  });

  it('rejects an explicit selection given alongside --plan', async () => {
    await expect(
      resolvePlanFlag(
        { plan: 'whatever', experiments: ['a'], evals: [] },
        { experiments: ['a'], evals: ['701'] },
        '--cases/--workflows'
      )
    ).rejects.toThrow(/drop --cases\/--workflows/);
  });
});

describe('laterSince', () => {
  it('picks the CLI date when it is later than the plan date', () => {
    expect(laterSince('2026-08-20', new Date('2026-08-10'))).toBe('2026-08-20');
  });

  it('picks the plan date when the CLI date is earlier', () => {
    const planSince = new Date('2026-08-20');
    expect(laterSince('2026-08-10', planSince)).toBe(planSince.toISOString());
  });

  it('uses the CLI date when the plan has none', () => {
    expect(laterSince('2026-08-10', null)).toBe('2026-08-10');
  });

  it('uses the plan date when the CLI has none', () => {
    const planSince = new Date('2026-08-20');
    expect(laterSince(null, planSince)).toBe(planSince.toISOString());
  });

  it('returns null when neither is set', () => {
    expect(laterSince(null, null)).toBeNull();
  });
});
