/**
 * Spawning one measured child process and reading its result back.
 *
 * Every measurement runs in a fresh process so it starts from a clean heap; an engine measured after
 * another engine's garbage would report that garbage as its own.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { SeriesResult } from '../docgen-shared/series.ts';

export interface SeriesChildSpec {
  childPath: string;
  args: string[];
  /**
   * Run the child under the jiti loader. Only the reused docgen-memory harness needs it: under
   * jiti, react-docgen's browserslist dependency fails on its JSON data require
   * ("jsReleases.map is not a function"), so the legacy child must run on native type stripping.
   */
  jiti?: boolean;
}

function tailOf(output: string): string {
  return output
    .trim()
    .split('\n')
    .slice(-4)
    .map((line) => `    ${line}`)
    .join('\n');
}

/**
 * Run one series-harness child and parse its result JSON. A non-zero exit, or a missing or
 * unreadable result, is a failure - never a silently empty measurement.
 */
export function runSeriesChild(
  spec: SeriesChildSpec,
  outDir: string,
  jsonPath: string
): SeriesResult {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  // Remove any stale result so a crashed run cannot be mistaken for a prior success.
  fs.rmSync(jsonPath, { force: true });

  const nodeArgs = [
    '--expose-gc',
    ...(spec.jiti ? ['--import', 'jiti/register'] : []),
    spec.childPath,
    ...spec.args,
    '--out',
    outDir,
    '--json',
    jsonPath,
  ];

  const proc = spawnSync(process.execPath, nodeArgs, { encoding: 'utf8' });
  const output = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;

  if (proc.status !== 0) {
    throw new Error(`child exited with status ${proc.status}:\n${tailOf(output)}`);
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`child wrote no result JSON at ${jsonPath}:\n${tailOf(output)}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SeriesResult;
}
