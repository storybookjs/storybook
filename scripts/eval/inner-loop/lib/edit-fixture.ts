/**
 * Apply / revert synthetic edits idempotently against the working tree.
 *
 * Each scenario specifies `find` + `replaceWith`. Apply maps find→replaceWith;
 * revert maps replaceWith→find. Both throw if the expected source isn't
 * present, so we never corrupt unrelated state.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Scenario } from '../scenarios.ts';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

export async function applyEdit(scenario: Scenario): Promise<void> {
  const abs = join(REPO_ROOT, scenario.filePath);
  const source = await readFile(abs, 'utf8');
  if (!source.includes(scenario.find)) {
    if (source.includes(scenario.replaceWith)) {
      throw new Error(
        `Edit already applied to ${scenario.filePath}. Run revert first.`
      );
    }
    throw new Error(
      `Cannot find expected source in ${scenario.filePath}. Did the file change upstream?`
    );
  }
  const next = source.replace(scenario.find, scenario.replaceWith);
  if (next === source) throw new Error(`Replace was a no-op in ${scenario.filePath}`);
  await writeFile(abs, next, 'utf8');
}

export async function revertEdit(scenario: Scenario): Promise<void> {
  const abs = join(REPO_ROOT, scenario.filePath);
  const source = await readFile(abs, 'utf8');
  if (!source.includes(scenario.replaceWith)) {
    if (source.includes(scenario.find)) return; // already reverted
    throw new Error(
      `Cannot revert ${scenario.filePath}: neither find nor replaceWith present.`
    );
  }
  const next = source.replace(scenario.replaceWith, scenario.find);
  await writeFile(abs, next, 'utf8');
}

export async function getRawDiff(scenario: Scenario): Promise<string> {
  try {
    return execSync(`git diff --no-color -- ${scenario.filePath}`, {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
  } catch {
    return '';
  }
}
