/**
 * Adapter for the Compodoc engine. Compodoc is a one-shot CLI - a fresh process per run - so this
 * adapter runs inside the orchestrator and spawns the compodoc CLI itself as the measured child:
 * cold extraction and whole-project scan are the same full-project run, warm extraction is a second
 * full run after touching one component file, and peak memory is the child's peak RSS sampled from
 * outside the process.
 *
 * The compodoc binary is resolved at runtime: it is a user-project dependency in this repo, not a
 * workspace package, so the engine skips with an explicit message when no binary is found. Version
 * pinning is baseline work.
 */
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';
import type { AngularScenarioConfig } from '../config.ts';

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
      const ps = spawnSync('ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' });
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

export interface CompodocRepetition {
  coldMs: number;
  warmMs: number;
  peakRssMb: number;
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
): Promise<CompodocRepetition> {
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
