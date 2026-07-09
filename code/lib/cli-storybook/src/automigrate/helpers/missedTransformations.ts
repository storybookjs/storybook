import { promises as fs } from 'node:fs';
import { resolve, sep } from 'node:path';

import { commonGlobOptions, getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { FixId, MissedTransformationMatch, MissedTransformationPattern } from '../types.ts';

const SCAN_EXTENSIONS = [
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'mts',
  'cts',
  'vue',
  'svelte',
  'mdx',
];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENCY = 10;

export async function detectMissedTransformations({
  patterns,
  safeFiles,
  safeDirs,
  cwd = getProjectRoot(),
}: {
  patterns: Array<{ fixId: FixId } & MissedTransformationPattern>;
  safeFiles: string[];
  safeDirs: string[];
  cwd?: string;
}): Promise<MissedTransformationMatch[]> {
  if (patterns.length === 0) {
    return [];
  }

  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const files = await globby([`**/*.{${SCAN_EXTENSIONS.join(',')}}`], {
      ...commonGlobOptions(''),
      cwd,
      dot: true,
      gitignore: true,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/storybook-static/**',
        '**/.git/**',
        '**/coverage/**',
      ],
    });

    const safeFileSet = new Set(safeFiles.filter(Boolean).map((f) => resolve(f)));
    const safeDirPrefixes = safeDirs.filter(Boolean).map((d) => resolve(d) + sep);
    const filesToScan = files.filter((file) => {
      const resolved = resolve(file);
      return !safeFileSet.has(resolved) && !safeDirPrefixes.some((p) => resolved.startsWith(p));
    });

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(MAX_CONCURRENCY);
    const matches: MissedTransformationMatch[] = [];

    await Promise.all(
      filesToScan.map((file) =>
        limit(async () => {
          try {
            const stat = await fs.stat(file);
            if (stat.size > MAX_FILE_SIZE_BYTES) {
              return;
            }
            const content = await fs.readFile(file, 'utf-8');
            for (const pattern of patterns) {
              pattern.regex.lastIndex = 0;
              if (pattern.regex.test(content)) {
                matches.push({
                  file,
                  fixId: pattern.fixId,
                  label: pattern.label,
                  replacement: pattern.replacement,
                });
              }
            }
          } catch {
            // Best-effort: skip unreadable/binary/race-deleted files.
          }
        })
      )
    );

    return matches;
  } catch (error) {
    // Best-effort: a scanner setup failure (e.g. globby/p-limit import) must never fail
    // the whole automigrate/upgrade run - this feature only reports, it never gates.
    logger.debug(`Missed-transformations scan failed, skipping: ${error}`);
    return [];
  }
}

/**
 * Collects `{ fixId, ...pattern }` entries from a single fix's `detectMissedTransformations`
 * hook, tolerating a fix that doesn't declare one or whose hook throws. Shared by both the
 * single-project (`index.ts`) and multi-project (`multi-project.ts`) callers so the two can't
 * drift apart.
 */
export function collectMissedTransformationPatterns<ResultType>(
  fix: {
    id: FixId;
    detectMissedTransformations?: (result: ResultType) => MissedTransformationPattern[];
  },
  result: ResultType
): Array<{ fixId: FixId } & MissedTransformationPattern> {
  if (typeof fix.detectMissedTransformations !== 'function') {
    return [];
  }
  try {
    return fix.detectMissedTransformations(result).map((p) => ({ fixId: fix.id, ...p }));
  } catch (error) {
    logger.debug(`Failed to compute missed-transformation patterns for ${fix.id}: ${error}`);
    return [];
  }
}

export function formatMissedTransformationsMessage(
  matches: MissedTransformationMatch[] | undefined,
  { shortenPath }: { shortenPath: (path: string) => string }
): string | null {
  if (!matches || matches.length === 0) {
    return null;
  }

  const byKey = new Map<
    string,
    { fixId: FixId; label: string; replacement: string; files: string[] }
  >();
  for (const m of matches) {
    const key = `${m.fixId}::${m.label}`;
    const entry = byKey.get(key) ?? {
      fixId: m.fixId,
      label: m.label,
      replacement: m.replacement,
      files: [],
    };
    entry.files.push(m.file);
    byKey.set(key, entry);
  }

  const MAX_FILES_SHOWN = 20;
  const groups = [...byKey.values()].map(({ fixId, label, replacement, files }) => {
    const shown = files.slice(0, MAX_FILES_SHOWN);
    const remaining = files.length - shown.length;
    return [
      `${fixId} (still contains "${label}", replace with "${replacement}"):`,
      ...shown.map((f) => `  - ${shortenPath(f)}`),
      ...(remaining > 0 ? [`  ...and ${remaining} more file(s)`] : []),
    ].join('\n');
  });

  return [
    'Possible missed transformations:',
    "Some automigrations rewrite patterns (like package imports) in your Storybook's config and story files. " +
      "We also scanned the rest of your project for files that still contain those patterns, but Storybook couldn't safely determine whether they belong to this Storybook instance " +
      '(for example, files shared with another Storybook project in a monorepo), so they were left untouched.',
    'If any of the files below do belong to this Storybook, please apply the same change manually:',
    ...groups,
  ].join('\n\n');
}
