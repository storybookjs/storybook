/**
 * Adapter for the Compodoc engine. Compodoc is a one-shot CLI - a fresh process per run - so this
 * adapter spawns the compodoc CLI itself as the measured child: cold extraction and whole-project
 * scan are the same full-project run, warm extraction is a second full run after touching one
 * component file, and peak memory is the child's peak RSS sampled from outside the process.
 *
 * `@compodoc/compodoc` is pinned exactly in `scripts/package.json`, matching the version the Angular
 * docgen baselines capture against (`code/lib/docgen-harness/README.md`) - a caret range would let
 * the numbers drift across compodoc versions without anyone deciding to.
 */
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type OneShotRepetition, oneShotMetrics } from '../aggregate.ts';
import { BenchEngine, type MeasureContext, type ScenarioSpec } from '../engine.ts';
import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';
import type { AngularScenarioConfig, SuiteProfile } from '../config.ts';
import type { EngineId } from '../../docgen-shared/engine-ids.ts';
import type { EngineMetrics } from '../types.ts';

/**
 * Walked up from the resolved binary rather than a fixed path, since the package hoists to
 * different node_modules depending on the install.
 */
export function compodocVersion(binary: string): string | undefined {
  try {
    let dir = path.dirname(fs.realpathSync(binary));
    for (let up = 0; up < 5; up++) {
      const candidate = path.join(dir, 'package.json');
      if (fs.existsSync(candidate)) {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (pkg.name === '@compodoc/compodoc') {
          return pkg.version as string;
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    // A binary on PATH may not sit inside a package at all; an unknown version is not a failure.
  }
  return undefined;
}

/** Locations probed for a compodoc binary, in order: workspace .bin dirs, then PATH. */
export function resolveCompodocBinary(): string | undefined {
  const candidates = [
    path.resolve(import.meta.dirname, '../../../node_modules/.bin/compodoc'),
    path.resolve(import.meta.dirname, '../../../../node_modules/.bin/compodoc'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const which = spawnSync('which', ['compodoc'], { encoding: 'utf8' });
  const fromPath = which.status === 0 ? which.stdout.trim() : '';
  return fromPath || undefined;
}

interface CompodocRun {
  durMs: number;
  peakRssMb: number;
}

/** Run compodoc once over the project, polling the child's RSS from outside. */
function runCompodocOnce(
  binary: string,
  projectDir: string,
  docsOutDir: string,
  pollIntervalMs: number
): Promise<CompodocRun> {
  fs.rmSync(docsOutDir, { recursive: true, force: true });
  const args = ['-p', 'tsconfig.json', '-e', 'json', '-d', docsOutDir, '--silent'];

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(binary, args, { cwd: projectDir });
    let peakRssKb = 0;
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

    const poll = setInterval(() => {
      if (child.pid === undefined) {
        return;
      }
      // `ps` is absent on Windows, and it exits non-zero once the child is gone. Either way this
      // throws from a timer callback if it is not guarded, which no per-engine catch can reach.
      const ps = spawnSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' });
      if (ps.error || typeof ps.stdout !== 'string') {
        return;
      }
      const rssKb = Number(ps.stdout.trim());
      if (Number.isFinite(rssKb) && rssKb > peakRssKb) {
        peakRssKb = rssKb;
      }
    }, pollIntervalMs);

    child.on('error', (err) => {
      clearInterval(poll);
      reject(err);
    });
    child.on('close', (status) => {
      clearInterval(poll);
      const durMs = Date.now() - start;
      if (status !== 0) {
        const tail = output.trim().split('\n').slice(-8).join('\n');
        reject(new Error(`compodoc exited with status ${status}:\n${tail}`));
        return;
      }
      if (!fs.existsSync(path.join(docsOutDir, 'documentation.json'))) {
        reject(new Error('compodoc run produced no documentation.json'));
        return;
      }
      // The polled peak misses spikes shorter than the interval; the recorded value is a floor.
      resolve({ durMs, peakRssMb: peakRssKb / 1024 });
    });
  });
}

/**
 * One repetition: fresh project, cold full run, touch one component, warm full run. Both runs are
 * fresh compodoc processes, matching the one-sample-per-fresh-process topology.
 */
export async function runCompodocRepetition(
  binary: string,
  scenario: AngularScenarioConfig,
  workDir: string,
  pollIntervalMs: number
): Promise<OneShotRepetition> {
  const projectDir = path.join(workDir, 'project');
  const docsOutDir = path.join(workDir, 'docs');
  const project = generateAngularProject({
    outDir: projectDir,
    components: scenario.components,
    props: scenario.props,
  });

  const cold = await runCompodocOnce(binary, project.outDir, docsOutDir, pollIntervalMs);

  // Touch one component so the warm run sees a genuinely changed file.
  fs.writeFileSync(project.componentPaths[0], angularComponentSource(0, scenario.props + 1));
  const warm = await runCompodocOnce(binary, project.outDir, docsOutDir, pollIntervalMs);

  return {
    coldMs: cold.durMs,
    warmMs: warm.durMs,
    peakRssMb: Math.max(cold.peakRssMb, warm.peakRssMb),
  };
}

/**
 * Compodoc as an engine. Unlike the series engines it has no child harness to spawn: the CLI is the
 * measured process, and this class drives it directly.
 *
 * It is also the only engine with state - the resolved binary, found once in {@link preflight} and
 * reused for every repetition and for the recorded version.
 */
export class CompodocEngine extends BenchEngine<OneShotRepetition> {
  readonly id: EngineId = 'compodoc';

  #binary: string | undefined;

  scenarios(profile: SuiteProfile): ScenarioSpec[] {
    return [{ name: 'default', params: { ...profile.angular } }];
  }

  preflight(): string | undefined {
    this.#binary = resolveCompodocBinary();
    return this.#binary
      ? undefined
      : 'no compodoc binary found (workspace node_modules/.bin or PATH); @compodoc/compodoc is pinned in scripts/package.json, so run yarn install';
  }

  version(): string | undefined {
    return this.#binary ? compodocVersion(this.#binary) : undefined;
  }

  async measure(ctx: MeasureContext, scenario: ScenarioSpec): Promise<OneShotRepetition> {
    if (!this.#binary) {
      throw new Error('compodoc binary unresolved; preflight must run first');
    }
    return runCompodocRepetition(
      this.#binary,
      { components: Number(scenario.params.components), props: Number(scenario.params.props) },
      ctx.scenarioDir,
      ctx.rssPollIntervalMs
    );
  }

  aggregate(samples: OneShotRepetition[], expectedN: number): EngineMetrics {
    return oneShotMetrics(samples, expectedN);
  }
}
