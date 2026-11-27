/**
 * Builds the OS-sensitivity manifest from the Linux probe records, and runs the Windows unit tests
 * the manifest marks as OS-sensitive.
 *
 * Usage:
 *
 * - `node scripts/ci/os-probe/manifest.ts build <probe-dir> <manifest>`
 * - `node scripts/ci/os-probe/manifest.ts run <manifest> [vitest options as JSON]`
 *
 * With `STORYBOOK_WINDOWS_UNIT_FULL=true`, `run` runs every test file and writes the failed ones
 * the manifest would have skipped, the probe's misses, to `misses.txt` beside the manifest.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { dirname, join, relative } from 'pathe';

type Hit = { api: string; frame: string };
type ManifestEntry = { hash: string; hits: Hit[] };
export type Manifest = {
  version: 1;
  revision: string | undefined;
  /** Every probed test file. A file with hits reached an OS-dependent API from repository code. */
  files: Record<string, ManifestEntry>;
};

const MANIFEST_VERSION = 1;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs|mts)$/;
const TEST_ROOTS = ['code/', 'scripts/', 'ecosystem-qa/'];
const EXCLUDED = /(^|\/)(node_modules|e2e-sandbox|e2e-internal)\//;
/** Windows-only tests often gate on a helper the runtime probe cannot see the test file read. */
const MENTIONS_WINDOWS = /win32|windows/i;

/** Line endings differ between checkouts, so they do not count as a change. */
const readSource = async (file: string) => (await readFile(file, 'utf8')).replaceAll('\r', '');
const hash = (source: string) => createHash('sha1').update(source).digest('hex');

const listTestFiles = async () => {
  const { stdout } = await promisify(execFile)('git', ['ls-files', '-z', ...TEST_ROOTS], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .split('\0')
    .filter((file) => TEST_FILE.test(file) && !EXCLUDED.test(file))
    .sort();
};

export async function buildManifest(probeDir: string): Promise<Manifest> {
  const files: Record<string, ManifestEntry> = {};
  for (const name of (await readdir(probeDir)).sort()) {
    const record = JSON.parse(await readFile(join(probeDir, name), 'utf8')) as {
      file: string;
      hits: Hit[];
    };
    const source = await readSource(record.file);
    const hits = MENTIONS_WINDOWS.test(source)
      ? [{ api: 'source mentions Windows', frame: record.file }, ...record.hits]
      : record.hits;
    files[record.file] = { hash: hash(source), hits };
  }
  return { version: MANIFEST_VERSION, revision: process.env.CIRCLE_SHA1, files };
}

export type Selection = {
  selected: string[];
  reasons: { sensitive: number; changed: number; unknown: number; skipped: number };
};

/**
 * Picks the test files to run on Windows: those that reached an OS-dependent API on Linux, and
 * those the manifest cannot vouch for because they are new or changed since it was built.
 */
export async function selectTests(manifest: Manifest, testFiles: string[]): Promise<Selection> {
  const reasons = { sensitive: 0, changed: 0, unknown: 0, skipped: 0 };
  const selected: string[] = [];
  for (const file of testFiles) {
    const entry = manifest.files[file];
    if (!entry) {
      reasons.unknown++;
    } else if (entry.hash !== hash(await readSource(file))) {
      reasons.changed++;
    } else if (entry.hits.length > 0) {
      reasons.sensitive++;
    } else {
      reasons.skipped++;
      continue;
    }
    selected.push(file);
  }
  return { selected, reasons };
}

const readManifest = async (file: string): Promise<Manifest | undefined> => {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
  } catch {
    return undefined;
  }
  const revision = process.env.CIRCLE_SHA1;
  if (manifest.version !== MANIFEST_VERSION) {
    return undefined;
  }
  if (revision && manifest.revision !== revision) {
    console.log(`The manifest is from ${manifest.revision}, not ${revision}.`);
    return undefined;
  }
  return manifest;
};

async function run(manifestFile: string, vitestOptions: Record<string, unknown>) {
  const { startVitest } = await import('vitest/node');
  const full = process.env.STORYBOOK_WINDOWS_UNIT_FULL === 'true';
  const manifest = await readManifest(manifestFile);
  const testFiles = await listTestFiles();
  const selection = manifest && (await selectTests(manifest, testFiles));

  if (!selection) {
    console.log(`No usable manifest at ${manifestFile}; running every test file.`);
  } else {
    const { selected, reasons } = selection;
    console.log(
      `Manifest from ${manifest.revision ?? 'unknown revision'}: ${selected.length} test files ` +
        `selected (${reasons.sensitive} OS-sensitive, ${reasons.changed} changed, ${reasons.unknown} new), ` +
        `${reasons.skipped} skipped.`
    );
  }
  if (full) {
    console.log('Full run requested; running every test file.');
  } else if (selection?.selected.length === 0) {
    return;
  }

  const filters = full || !selection ? [] : selection.selected;
  const vitest = await startVitest('test', filters, { run: true, ...vitestOptions });
  if (vitest && full && selection) {
    const selected = new Set(selection.selected);
    // Only files the selection decides on; type tests, for one, never run in a selected run.
    const selectable = new Set(testFiles);
    const failed = vitest.state
      .getTestModules()
      .filter((testModule) => testModule.state() === 'failed')
      .map((testModule) => relative(process.cwd(), testModule.moduleId));
    // A file in two projects fails in each.
    const misses = [...new Set(failed)]
      .filter((file) => selectable.has(file) && !selected.has(file))
      .sort();
    const missesFile = join(dirname(manifestFile), 'misses.txt');
    await mkdir(dirname(missesFile), { recursive: true });
    await writeFile(missesFile, misses.map((file) => `${file}\n`).join(''));
    console.log(
      misses.length === 0
        ? 'Every failed test file was selected; the probe missed none.'
        : `The probe missed ${misses.length} failed test files, listed in ${missesFile}:\n${misses.join('\n')}`
    );
  }
  await vitest?.close();
  // `tests--linux` writes the manifest even when its tests fail, so on CI a missing one means the
  // handoff broke. The tests ran in full; the job still fails so the break does not go unseen.
  if (!selection && process.env.CIRCLECI) {
    console.error(`No usable manifest at ${manifestFile} from tests--linux.`);
    process.exitCode = 1;
  }
}

const [command, ...args] = process.argv.slice(2);

if (command === 'build') {
  const [probeDir, out] = args;
  const manifest = await buildManifest(probeDir);
  await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
  const all = Object.values(manifest.files);
  const sensitive = all.filter((entry) => entry.hits.length > 0).length;
  console.log(`Wrote ${out}: ${sensitive} of ${all.length} test files are OS-sensitive.`);
} else if (command === 'run') {
  const [manifestFile, options = '{}'] = args;
  await run(manifestFile, JSON.parse(options));
} else if (command !== undefined) {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
