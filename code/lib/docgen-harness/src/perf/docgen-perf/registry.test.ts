import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { SeriesResult } from '../docgen-shared/series.ts';
import { QUICK_PROFILE } from './config.ts';
import { type MeasureContext, type ScenarioSpec, SeriesChildEngine } from './engine.ts';
import { CONTROL_PAIRS } from './ratios.ts';
import { ALL_ENGINE_IDS, DEFAULT_ENGINE_IDS, ENGINES, engineById } from './registry.ts';
import type { EngineId } from './types.ts';

/** Captures what an engine would have spawned, without spawning it. */
function captureSpawn() {
  const calls: Array<{ spec: Parameters<MeasureContext['runSeriesChild']>[0]; jsonPath: string }> =
    [];
  const ctx: MeasureContext = {
    scenarioDir: '/tmp/scenario',
    runSeriesChild(spec, _outDir, jsonPath) {
      calls.push({ spec, jsonPath });
      return {} as SeriesResult;
    },
  };
  return { ctx, calls };
}

async function specFor(id: EngineId, scenario: ScenarioSpec, rep = 1) {
  const { ctx, calls } = captureSpawn();
  await engineById(id).measure(ctx, scenario, rep);
  return calls[0];
}

/** Everything that describes the generated project, which is what a flag comparison is about. */
function withoutPin(args: string[]): string[] {
  const pin = args.indexOf('--pin');
  return pin === -1 ? args : [...args.slice(0, pin), ...args.slice(pin + 2)];
}

const reactScenario = engineById('react-legacy').scenarios(QUICK_PROFILE)[0];
const vueFlatScenario = engineById('vue-component-meta')
  .scenarios(QUICK_PROFILE)
  .find((s) => s.name === 'flat')!;

describe('the engine table', () => {
  it('registers each id exactly once', () => {
    expect(new Set(ALL_ENGINE_IDS).size).toBe(ALL_ENGINE_IDS.length);
  });

  it('keeps the unbudgeted react-docgen-typescript engine out of the default run', () => {
    expect(DEFAULT_ENGINE_IDS).not.toContain('react-legacy-rdt');
    expect(ALL_ENGINE_IDS).toContain('react-legacy-rdt');
  });

  it('names an engine that is not registered', () => {
    expect(() => engineById('svelte' as EngineId)).toThrow('no engine registered for "svelte"');
  });

  it('gives every engine at least one scenario, with unique names', () => {
    for (const engine of ENGINES) {
      const names = engine.scenarios(QUICK_PROFILE).map((s) => s.name);
      expect(names.length, engine.id).toBeGreaterThan(0);
      expect(new Set(names).size, engine.id).toBe(names.length);
    }
  });

  it('registers both sides of every control pair', () => {
    // A pair naming an unregistered engine would silently never produce a ratio.
    for (const pair of CONTROL_PAIRS) {
      expect(ALL_ENGINE_IDS, pair.name).toContain(pair.legacy);
      expect(ALL_ENGINE_IDS, pair.name).toContain(pair.next);
    }
  });

  it('runs both sides of every control pair that is on by default', () => {
    // A ratio needs both sides measured in the same invocation.
    for (const pair of CONTROL_PAIRS) {
      if (!DEFAULT_ENGINE_IDS.includes(pair.next)) {
        continue; // e.g. vue-component-meta-version: opt-in, no budget row yet
      }
      expect(DEFAULT_ENGINE_IDS, pair.name).toContain(pair.legacy);
      expect(DEFAULT_ENGINE_IDS, pair.name).toContain(pair.next);
    }
  });
});

describe('what the series engines spawn', () => {
  it('points every spawning engine at a child script that exists', async () => {
    // `child` is a plain string joined onto this directory, so nothing typechecks it. A wrong
    // value only surfaces at runtime, for one engine, after the full project generation has
    // already been paid for. `react-osa` reaches into ../docgen-memory, so this also pins the
    // sibling layout of docgen-perf, docgen-memory and docgen-shared.
    const spawning = ENGINES.filter((engine) => engine instanceof SeriesChildEngine);
    expect(spawning.length).toBeGreaterThan(0);
    for (const engine of spawning) {
      const { spec } = await specFor(engine.id, engine.scenarios(QUICK_PROFILE)[0]);
      expect(fs.existsSync(spec.childPath), `${engine.id} -> ${spec.childPath}`).toBe(true);
    }
  });

  it('runs only the reused memory harness under jiti', async () => {
    // Under jiti, react-docgen's browserslist dependency fails its JSON data require, so the
    // legacy child must run on native type stripping.
    expect((await specFor('react-osa', reactScenario)).spec.jiti).toBe(true);
    expect((await specFor('react-legacy', reactScenario)).spec.jiti).toBeFalsy();
    expect((await specFor('react-legacy-rdt', reactScenario)).spec.jiti).toBeFalsy();
  });

  it('sends the two React legacy engines to one child with different parsers', async () => {
    const legacy = await specFor('react-legacy', reactScenario);
    const rdt = await specFor('react-legacy-rdt', reactScenario);
    expect(rdt.spec.childPath).toBe(legacy.spec.childPath);
    expect(legacy.spec.args).toContain('react-docgen');
    expect(rdt.spec.args).toContain('react-docgen-typescript');
  });

  it('measures both React engines on one changed component per save', async () => {
    // Equal work on both sides is what makes the React ratio an engine comparison.
    for (const id of ['react-legacy', 'react-osa'] as EngineId[]) {
      const { spec } = await specFor(id, reactScenario);
      expect(spec.args.slice(spec.args.indexOf('--scope')), id).toEqual(['--scope', 'changed']);
    }
  });

  it('passes the scenario size through to the child', async () => {
    const { spec } = await specFor('react-legacy', reactScenario);
    const components = spec.args[spec.args.indexOf('--components') + 1];
    expect(components).toBe(String(QUICK_PROFILE.react[0].components));
  });

  it('runs both React shapes, and tells the child which one it is measuring', async () => {
    const shapes = engineById('react-osa')
      .scenarios(QUICK_PROFILE)
      .map((scenario) => scenario.name);
    expect(shapes).toEqual(['whole-index', 'first-story']);

    for (const scenario of engineById('react-osa').scenarios(QUICK_PROFILE)) {
      const { spec } = await specFor('react-osa', scenario);
      expect(spec.args[spec.args.indexOf('--shape') + 1], scenario.name).toBe(scenario.name);
    }
  });

  it('gives the React engines identical flags per shape, so a ratio compares engines not shapes', async () => {
    for (const scenario of engineById('react-osa').scenarios(QUICK_PROFILE)) {
      const osa = await specFor('react-osa', scenario);
      const legacy = await specFor('react-legacy', scenario);
      const shapeOf = (args: string[]) => args[args.indexOf('--shape') + 1];
      expect(shapeOf(osa.spec.args), scenario.name).toBe(shapeOf(legacy.spec.args));
    }
  });

  it('passes --heavy-lib only for scenarios that ask for it', async () => {
    const scenarios = engineById('vue-component-meta').scenarios(QUICK_PROFILE);
    const flat = scenarios.find((s) => s.name === 'flat')!;
    const workspace = scenarios.find((s) => s.name === 'workspace')!;
    expect((await specFor('vue-component-meta', flat)).spec.args).not.toContain('--heavy-lib');
    expect((await specFor('vue-component-meta', workspace)).spec.args).toContain('--heavy-lib');
  });

  it('gives the two Vue engines identical flags, so the ratio compares engines not projects', async () => {
    for (const scenario of engineById('vue-docgen-api').scenarios(QUICK_PROFILE)) {
      const legacy = await specFor('vue-docgen-api', scenario);
      const meta = await specFor('vue-component-meta', scenario);
      expect(withoutPin(meta.spec.args), scenario.name).toEqual(withoutPin(legacy.spec.args));
      expect(meta.spec.childPath).not.toBe(legacy.spec.childPath);
    }
  });

  it('writes each repetition to its own result file', async () => {
    expect((await specFor('react-legacy', reactScenario, 3)).jsonPath).toMatch(/rep3\.json$/);
  });

  it('sends the two vue-component-meta versions to one child with different pins', async () => {
    const current = await specFor('vue-component-meta', vueFlatScenario);
    const next = await specFor('vue-component-meta-next', vueFlatScenario);
    expect(next.spec.childPath).toBe(current.spec.childPath);
    expect(current.spec.args.slice(-2)).toEqual(['--pin', 'vue-component-meta']);
    expect(next.spec.args.slice(-2)).toEqual(['--pin', 'vue-component-meta-next']);
  });

  it('gives both vue-component-meta versions identical flags apart from --pin', async () => {
    for (const scenario of engineById('vue-component-meta').scenarios(QUICK_PROFILE)) {
      const current = await specFor('vue-component-meta', scenario);
      const next = await specFor('vue-component-meta-next', scenario);
      expect(withoutPin(next.spec.args)).toEqual(withoutPin(current.spec.args));
    }
  });

  it('resolves the two sides of the version pair to two different installs', () => {
    // The invariant, rather than the literal the alias happens to pin today: a caret range on the
    // current side is enough for both sides to land on one release, and the pair then compares an
    // engine against itself for a ratio of 1.00 that reads exactly like a clean result.
    const current = engineById('vue-component-meta').version();
    const next = engineById('vue-component-meta-next').version();
    expect(current).toMatch(/^\d+\.\d+\.\d+/);
    expect(next).toMatch(/^\d+\.\d+\.\d+/);
    expect(next).not.toBe(current);
  });

  it('skips a version-pinned engine whose install is missing, rather than losing its provenance', () => {
    // Both sides must report a version or the run cannot say whether it compared two installs.
    for (const id of ['vue-component-meta', 'vue-component-meta-next'] as EngineId[]) {
      expect(engineById(id).preflight(), id).toBeUndefined();
    }
  });
});
