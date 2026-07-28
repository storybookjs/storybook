import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { outputTail } from '../../docgen-shared/child-output.ts';
import { type OneShotRepetition, oneShotMetrics } from '../aggregate.ts';
import { type DocumentationCounts, countDocumentation } from './compodoc-doc.ts';
import type { AngularScenarioConfig, SuiteProfile } from '../config.ts';
import { BenchEngine, type MeasureContext, type ScenarioSpec } from '../engine.ts';
import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';
import type { EngineId, EngineMetrics } from '../types.ts';

const require = createRequire(import.meta.url);

interface ResolvedCompodoc {
  /** The CLI entry point, run as `node <cli>` so no shell shim or exec bit is involved. */
  cli: string;
  version: string;
}

function resolveCompodoc(): ResolvedCompodoc | undefined {
  try {
    const packagePath = require.resolve('@compodoc/compodoc/package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return {
      cli: path.join(path.dirname(packagePath), pkg.bin.compodoc),
      version: pkg.version,
    };
  } catch {
    return undefined;
  }
}

interface CompodocRun extends DocumentationCounts {
  durMs: number;
  peakRssMb: number;
}

function runCompodocOnce(
  cli: string,
  projectDir: string,
  docsOutDir: string,
  pollIntervalMs: number
): Promise<CompodocRun> {
  fs.rmSync(docsOutDir, { recursive: true, force: true });
  const args = [cli, '-p', 'tsconfig.json', '-e', 'json', '-d', docsOutDir, '--silent'];

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(process.execPath, args, { cwd: projectDir });
    let peakRssKb = 0;
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

    const poll = setInterval(() => {
      if (child.pid === undefined) {
        return;
      }

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
        reject(new Error(`compodoc exited with status ${status}:\n${outputTail(output, 8)}`));
        return;
      }
      const documentationJson = path.join(docsOutDir, 'documentation.json');
      if (!fs.existsSync(documentationJson)) {
        reject(new Error('compodoc run produced no documentation.json'));
        return;
      }
      // Counted before the next run overwrites the file, which both runs share.
      const counts = countDocumentation(documentationJson);
      // The polled peak misses spikes shorter than the interval; the recorded value is a floor.
      resolve({ durMs, peakRssMb: peakRssKb / 1024, ...counts });
    });
  });
}

/**
 * One repetition: fresh project, cold full run, touch one component, warm full run. Both runs are
 * fresh compodoc processes, matching the one-sample-per-fresh-process topology.
 */
export async function runCompodocRepetition(
  cli: string,
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

  const cold = await runCompodocOnce(cli, project.outDir, docsOutDir, pollIntervalMs);

  // Touch one component so the warm run sees a genuinely changed file.
  fs.writeFileSync(project.componentPaths[0], angularComponentSource(0, scenario.props + 1));
  const warm = await runCompodocOnce(cli, project.outDir, docsOutDir, pollIntervalMs);

  return {
    coldMs: cold.durMs,
    warmMs: warm.durMs,
    peakRssMb: Math.max(cold.peakRssMb, warm.peakRssMb),
    coldMembers: cold.members,
    // A second whole-project pass, so this counts the project, not the one file that changed. It is
    // not comparable with a series engine's warm count, which covers only the re-extracted member.
    warmMembers: warm.members,
    coldOpaqueTypes: cold.opaqueTypes,
  };
}

export class CompodocEngine extends BenchEngine<OneShotRepetition> {
  readonly id: EngineId = 'compodoc';

  #resolved: ResolvedCompodoc | undefined;

  scenarios(profile: SuiteProfile): ScenarioSpec[] {
    return [{ name: 'default', params: { ...profile.angular } }];
  }

  preflight(): string | undefined {
    this.#resolved = resolveCompodoc();
    return this.#resolved
      ? undefined
      : '@compodoc/compodoc did not resolve; it is pinned in scripts/package.json, so run yarn install';
  }

  version(): string | undefined {
    return this.#resolved?.version;
  }

  async measure(ctx: MeasureContext, scenario: ScenarioSpec): Promise<OneShotRepetition> {
    if (!this.#resolved) {
      throw new Error('compodoc unresolved; preflight must run first');
    }
    return runCompodocRepetition(
      this.#resolved.cli,
      { components: Number(scenario.params.components), props: Number(scenario.params.props) },
      ctx.scenarioDir,
      ctx.rssPollIntervalMs
    );
  }

  aggregate(samples: OneShotRepetition[], expectedN: number): EngineMetrics {
    return oneShotMetrics(samples, expectedN);
  }

  coldMembers(sample: OneShotRepetition): number | undefined {
    return sample.coldMembers;
  }

  warmMembers(sample: OneShotRepetition): number | undefined {
    return sample.warmMembers;
  }

  coldOpaqueTypes(sample: OneShotRepetition): number | undefined {
    return sample.coldOpaqueTypes;
  }
}
