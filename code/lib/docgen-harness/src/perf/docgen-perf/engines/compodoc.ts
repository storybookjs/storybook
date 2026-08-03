import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { outputTail } from '../../docgen-shared/child-output.ts';
import { type OneShotRepetition, oneShotMetrics } from '../aggregate.ts';
import { type DocumentationCounts, countDocumentation } from './compodoc-doc.ts';
import {
  type AngularScenarioConfig,
  COMPODOC_TIMEOUT_MS,
  RSS_POLL_INTERVAL_MS,
  type SuiteProfile,
} from '../config.ts';
import { BenchEngine, type MeasureContext, type ScenarioSpec } from '../engine.ts';
import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';
import type { EngineId, EngineMetrics, MemberCounts } from '../types.ts';

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
  /**
   * Undefined when no poll ever read the child's RSS - `ps` is POSIX-only, and a run shorter than
   * one interval is never sampled. Reporting the initial 0 instead would put a fabricated peak in
   * the results, which is the one thing a floor may not become.
   */
  peakRssMb: number | undefined;
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
    let peakRssKb: number | undefined;
    let output = '';
    let timedOut = false;
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

    // Killed rather than waited on: the close handler below is the only thing that settles this
    // promise, so a compodoc that hangs would otherwise stall the whole suite with no way out.
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, COMPODOC_TIMEOUT_MS);

    const poll = setInterval(() => {
      if (child.pid === undefined) {
        return;
      }

      const ps = spawnSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' });
      if (ps.error || typeof ps.stdout !== 'string') {
        return;
      }
      const rssKb = Number(ps.stdout.trim());
      if (Number.isFinite(rssKb) && (peakRssKb === undefined || rssKb > peakRssKb)) {
        peakRssKb = rssKb;
      }
    }, pollIntervalMs);

    const stopWatching = () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };

    child.on('error', (err) => {
      stopWatching();
      reject(err);
    });
    child.on('close', (status) => {
      stopWatching();
      const durMs = Date.now() - start;
      // Before the status check: a killed child closes with a null status, which would otherwise be
      // reported as an ordinary non-zero exit and hide why the run really ended.
      if (timedOut) {
        reject(
          new Error(
            `compodoc did not finish within ${COMPODOC_TIMEOUT_MS}ms:\n${outputTail(output, 8)}`
          )
        );
        return;
      }
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
      resolve({
        durMs,
        peakRssMb: peakRssKb === undefined ? undefined : peakRssKb / 1024,
        ...counts,
      });
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

  const peaks = [cold.peakRssMb, warm.peakRssMb].filter((mb) => mb !== undefined);

  return {
    coldMs: cold.durMs,
    warmMs: warm.durMs,
    // Nothing sampled means no peak, not a peak of zero.
    peakRssMb: peaks.length ? Math.max(...peaks) : undefined,
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
    // The poll interval rides in params because it qualifies the peak this engine reports: the
    // sample misses spikes shorter than the gap between polls, so the recorded peak is a floor and
    // reading it later means knowing how wide that gap was.
    return [
      { name: 'default', params: { ...profile.angular, rssPollIntervalMs: RSS_POLL_INTERVAL_MS } },
    ];
  }

  preflight(): string | undefined {
    this.#resolved = resolveCompodoc();
    return this.#resolved
      ? undefined
      : '@compodoc/compodoc did not resolve; it is pinned in code/lib/docgen-harness/package.json, so run yarn install';
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
      // Read from the constant, not back out of `params`. `params` carries it so a stored run says
      // how wide the sampling gap was; the run itself has no reason to round-trip through it.
      RSS_POLL_INTERVAL_MS
    );
  }

  aggregate(samples: OneShotRepetition[], expectedN: number): EngineMetrics {
    return oneShotMetrics(samples, expectedN);
  }

  members(sample: OneShotRepetition): MemberCounts {
    return {
      coldMembers: sample.coldMembers,
      warmMembers: sample.warmMembers,
      coldOpaqueTypes: sample.coldOpaqueTypes,
    };
  }
}
