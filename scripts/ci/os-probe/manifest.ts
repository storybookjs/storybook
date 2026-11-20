/**
 * Builds the OS-sensitivity manifest from the Linux probe records, and runs the Windows unit tests
 * the manifest marks as OS-sensitive.
 *
 * Usage:
 *
 * - `node scripts/ci/os-probe/manifest.ts build <probe-dir> <manifest>`
 * - `node scripts/ci/os-probe/manifest.ts run <manifest> [vitest options as JSON]`
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { join } from 'pathe';

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
  try {
    const manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
    return manifest.version === MANIFEST_VERSION ? manifest : undefined;
  } catch {
    return undefined;
  }
};

async function run(manifestFile: string, vitestOptions: Record<string, unknown>) {
  const { startVitest } = await import('vitest/node');
  const manifest = await readManifest(manifestFile);
  let filters: string[] = [];

  if (!manifest) {
    console.log(`No usable manifest at ${manifestFile}; running every test file.`);
  } else {
    const { selected, reasons } = await selectTests(manifest, await listTestFiles());
    console.log(
      `Manifest from ${manifest.revision ?? 'unknown revision'}: running ${selected.length} test files ` +
        `(${reasons.sensitive} OS-sensitive, ${reasons.changed} changed, ${reasons.unknown} new), ` +
        `skipping ${reasons.skipped}.`
    );
    if (selected.length === 0) {
      return;
    }
    filters = selected;
  }

  const vitest = await startVitest('test', filters, { run: true, ...vitestOptions });
  await vitest?.close();
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
