import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';
import picocolors from 'picocolors';
import semver from 'semver';

const PRERELEASE_CHANGELOG_PATH = fileURLToPath(
  new URL('../../../CHANGELOG.prerelease.md', import.meta.url)
);
const STABLE_CHANGELOG_PATH = fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url));

const program = new Command();

program
  .name('get-minor-changelog-summary')
  .description(
    'Collects all changelog entries from prereleases of a minor/major version, filtering out changes that were already shipped in patch releases of the previous minor. If no version is given, the stable version of the most recent prerelease is used.'
  )
  .arguments('[version]')
  .option('-V, --verbose', 'Enable verbose logging', false);

/**
 * Parse a markdown changelog file into a map of version string -> section body.
 * Sections are delineated by `## <version>` headings.
 */
function parseChangelogSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = content.split(/^## /m);
  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }
    const newlineIdx = part.indexOf('\n');
    const version = newlineIdx === -1 ? part.trim() : part.slice(0, newlineIdx).trim();
    const body = newlineIdx === -1 ? '' : part.slice(newlineIdx + 1);
    sections.set(version, body);
  }
  return sections;
}

/** Extract all PR numbers referenced in a changelog section body. */
function extractPRNumbers(content: string): Set<number> {
  const prNumbers = new Set<number>();
  const prRegex = /\[#(\d+)\]\(https:\/\/github\.com\//g;
  let match;
  while ((match = prRegex.exec(content)) !== null) {
    prNumbers.add(parseInt(match[1], 10));
  }
  return prNumbers;
}

/** Extract individual changelog list items (lines starting with `- `) from a section body. */
function extractEntries(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.trim());
}

export const getMinorChangelogSummary = async (args: { version?: string; verbose?: boolean }) => {
  const { verbose } = args;

  const log = (...msg: unknown[]) => {
    if (verbose) {
      console.error(...msg);
    }
  };

  const [prereleaseChangelog, stableChangelog] = await Promise.all([
    readFile(PRERELEASE_CHANGELOG_PATH, 'utf-8'),
    readFile(STABLE_CHANGELOG_PATH, 'utf-8'),
  ]);

  const preSections = parseChangelogSections(prereleaseChangelog);
  const stableSections = parseChangelogSections(stableChangelog);

  let version = args.version;
  if (!version) {
    const firstPrerelease = [...preSections.keys()][0];
    if (!firstPrerelease) {
      throw new Error(
        `No prerelease entries found in ${picocolors.green(PRERELEASE_CHANGELOG_PATH)}`
      );
    }
    const p = semver.parse(firstPrerelease);
    if (!p) {
      throw new Error(
        `Could not parse version from first prerelease entry: ${picocolors.red(firstPrerelease)}`
      );
    }
    version = `${p.major}.${p.minor}.0`;
    log(
      `🔍 No version specified, inferred ${picocolors.blue(version)} from most recent prerelease ${picocolors.green(firstPrerelease)}`
    );
  }

  const parsed = semver.parse(version);
  if (!parsed || parsed.patch !== 0 || parsed.prerelease.length > 0) {
    throw new Error(
      `Version must be a stable minor or major release (e.g. 10.4.0), got: ${picocolors.red(version)}`
    );
  }

  const { major, minor } = parsed;

  // Collect all prerelease versions for the target (e.g. 10.4.0-alpha.*, 10.4.0-beta.*, 10.4.0-rc.*)
  const prereleaseVersionPrefix = `${major}.${minor}.0-`;
  const prereleaseVersions = [...preSections.keys()]
    .filter((v) => v.startsWith(prereleaseVersionPrefix))
    .sort((a, b) => semver.compare(a, b));

  if (prereleaseVersions.length === 0) {
    throw new Error(
      `No prerelease versions found for ${picocolors.blue(version)} in ${picocolors.green(PRERELEASE_CHANGELOG_PATH)}`
    );
  }

  log(
    `🔍 Found ${picocolors.blue(prereleaseVersions.length)} prerelease version(s): ${prereleaseVersions.join(', ')}`
  );

  // Collect PR numbers that already shipped in patch releases of the previous minor (e.g. 10.3.1+)
  const patchPRNumbers = new Set<number>();

  if (minor > 0) {
    const prevMinor = minor - 1;
    const patchVersions = [...stableSections.keys()].filter((v) => {
      const p = semver.parse(v);
      return p && p.major === major && p.minor === prevMinor && p.patch > 0;
    });

    log(
      `🔍 Patch versions to filter out: ${picocolors.yellow(patchVersions.join(', ') || 'none')}`
    );

    for (const pv of patchVersions) {
      const body = stableSections.get(pv)!;
      for (const pr of extractPRNumbers(body)) {
        patchPRNumbers.add(pr);
      }
    }

    log(
      `🔍 Found ${picocolors.yellow(patchPRNumbers.size)} PR(s) already shipped in patch releases — these will be filtered out`
    );
  } else {
    log(`ℹ️  Version ${picocolors.blue(version)} is a major release, no patches to filter`);
  }

  // Aggregate changelog entries from all prereleases, deduplicating by PR number
  const entriesByPR = new Map<number, string>();
  const directCommitEntries: string[] = [];

  for (const preVersion of prereleaseVersions) {
    const body = preSections.get(preVersion)!;
    const entries = extractEntries(body);

    for (const entry of entries) {
      const prMatch = entry.match(/\[#(\d+)\]/);
      if (prMatch) {
        const prNum = parseInt(prMatch[1], 10);
        if (!patchPRNumbers.has(prNum) && !entriesByPR.has(prNum)) {
          entriesByPR.set(prNum, entry);
        }
      } else if (!directCommitEntries.includes(entry)) {
        directCommitEntries.push(entry);
      }
    }
  }

  const allEntries = [...entriesByPR.values(), ...directCommitEntries].sort();
  const text = allEntries.join('\n');

  log(`\n✅ Generated changelog summary (${picocolors.blue(allEntries.length)} entries):\n`);

  return { text, entryCount: allEntries.length, resolvedVersion: version };
};

function esMain(url: string): boolean {
  if (!url || !process.argv[1]) {
    return false;
  }
  const require = createRequire(url);
  const scriptPath = require.resolve(process.argv[1]);
  const modulePath = fileURLToPath(url);
  const extension = extname(scriptPath);
  return extension
    ? modulePath === scriptPath
    : modulePath.slice(0, -extname(modulePath).length) === scriptPath;
}

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  const [version] = parsed.args;
  if (version && !semver.valid(version)) {
    console.error(
      `🚨 Invalid argument, expected a semver version e.g. ${picocolors.green('10.4.0')}, got: ${picocolors.red(version)}`
    );
    process.exit(1);
  }
  const { text } = await getMinorChangelogSummary({ version, verbose: parsed.opts().verbose });
  console.log(text);
}
