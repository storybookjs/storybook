import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { outputTail } from '../../docgen-shared/child-output.ts';
import type { LatencyObservation, LatencyRepetition } from '../../docgen-shared/latency-series.ts';
import { COMPODOC_TIMEOUT_MS, type AngularScenarioConfig, type SuiteProfile } from '../config.ts';
import { BenchEngine, type MeasureContext, type ScenarioSpec } from '../engine.ts';
import type { EngineId } from '../types.ts';
import { type DocumentationCounts, countDocumentation } from './compodoc-doc.ts';
import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';

const require = createRequire(import.meta.url);

interface ResolvedCompodoc {
  cli: string;
  version: string;
}

function resolveCompodoc(): ResolvedCompodoc | undefined {
  try {
    const packagePath = require.resolve('@compodoc/compodoc/package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      bin: { compodoc: string };
      version: string;
    };
    return {
      cli: path.join(path.dirname(packagePath), pkg.bin.compodoc),
      version: pkg.version,
    };
  } catch {
    return undefined;
  }
}

interface CompodocRun extends DocumentationCounts {
  durationMs: number;
}

function runCompodocOnce(
  cli: string,
  projectDir: string,
  docsOutDir: string
): Promise<CompodocRun> {
  fs.rmSync(docsOutDir, { recursive: true, force: true });
  const args = [cli, '-p', 'tsconfig.json', '-e', 'json', '-d', docsOutDir, '--silent'];

  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn(process.execPath, args, { cwd: projectDir });
    let output = '';
    let timedOut = false;
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, COMPODOC_TIMEOUT_MS);

    const stopWatching = () => clearTimeout(timeout);
    child.on('error', (error) => {
      stopWatching();
      reject(error);
    });
    child.on('close', (status) => {
      stopWatching();
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
      resolve({ durationMs: performance.now() - start, ...countDocumentation(documentationJson) });
    });
  });
}

function observation(run: CompodocRun): LatencyObservation {
  return {
    durationMs: run.durationMs,
    members: run.members,
    opaqueTypes: run.opaqueTypes,
  };
}

/** One repetition uses fresh Compodoc processes for both full-project passes. */
export async function runCompodocRepetition(
  cli: string,
  scenario: AngularScenarioConfig,
  workDir: string
): Promise<LatencyRepetition> {
  const projectDir = path.join(workDir, 'project');
  const docsOutDir = path.join(workDir, 'docs');
  const project = generateAngularProject({
    outDir: projectDir,
    components: scenario.components,
    props: scenario.props,
  });

  const cold = observation(await runCompodocOnce(cli, project.outDir, docsOutDir));
  fs.writeFileSync(project.componentPaths[0], angularComponentSource(0, scenario.props + 1));
  const warm = observation(await runCompodocOnce(cli, project.outDir, docsOutDir));

  return { cold, scan: cold, warm: [{ save: 1, ...warm }] };
}

export class CompodocEngine extends BenchEngine {
  readonly id: EngineId = 'compodoc';

  #resolved: ResolvedCompodoc | undefined;

  scenarios(profile: SuiteProfile): ScenarioSpec[] {
    return [{ name: 'default', params: { ...profile.angular } }];
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

  async measure(ctx: MeasureContext, scenario: ScenarioSpec): Promise<LatencyRepetition> {
    if (!this.#resolved) {
      throw new Error('compodoc unresolved; preflight must run first');
    }
    return runCompodocRepetition(
      this.#resolved.cli,
      { components: Number(scenario.params.components), props: Number(scenario.params.props) },
      ctx.scenarioDir
    );
  }
}
