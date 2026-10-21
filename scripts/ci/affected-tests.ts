import { join } from 'pathe';

/** The part of an esbuild metafile this module reads; paths are relative to the package dir. */
export type Metafile = {
  outputs: Record<string, { inputs: Record<string, unknown> }>;
};

/** A workspace package as the build left it. All paths are repo-relative. */
export interface BuiltPackage {
  dir: string;
  /** `undefined` when the build wrote no metafiles that can be attributed to this package. */
  metafiles: Metafile[] | undefined;
  distFiles: string[];
  testFiles: string[];
}

/** What `select-affected-tests.ts` prints instead of a file list when the full suite must run. */
export const FULL_RUN_MARKER = 'full';

export type TestSelection = { kind: 'full' } | { kind: 'related'; files: string[] };

type FileKind = 'global' | 'test' | 'source' | 'asset';

/** First match wins; a file matching no row is an asset. */
const FILE_KINDS: readonly (readonly [FileKind, RegExp])[] = [
  [
    'global',
    /(^|\/)(package\.json|yarn\.lock|\.yarnrc[^/]*|nx\.json|\.nvmrc|tsconfig[^/]*\.json|vite(st)?[.-](config|workspace|shared|setup)[^/]*)$/,
  ],
  ['global', /^(\.yarn\/patches|code\/__mocks__)\//],
  ['test', /\.(test|spec|test-d)\.[cm]?[jt]sx?$/],
  // Fixtures, mocks and snapshots reach tests through the file system or mock resolution, not imports.
  ['asset', /(^|\/)(__[^/]+__|fixtures)\//],
  ['source', /\.([cm]?[jt]sx?|vue|svelte)$/],
];

export function classifyFile(file: string): FileKind {
  return FILE_KINDS.find(([, pattern]) => pattern.test(file))?.[0] ?? 'asset';
}

function indexOutputsByInput(packages: readonly BuiltPackage[]) {
  const outputsByInput = new Map<string, string[]>();

  for (const { dir, metafiles = [] } of packages) {
    for (const { outputs } of metafiles) {
      for (const [output, { inputs }] of Object.entries(outputs)) {
        for (const input of Object.keys(inputs)) {
          const key = join(dir, input);
          outputsByInput.set(key, [...(outputsByInput.get(key) ?? []), join(dir, output)]);
        }
      }
    }
  }

  return outputsByInput;
}

const RELATED_FILES: Record<
  Exclude<FileKind, 'global'>,
  (
    file: string,
    pkg: BuiltPackage | undefined,
    outputsByInput: ReadonlyMap<string, string[]>
  ) => string[]
> = {
  test: (file) => [file],
  // Without metafiles for its own package, or with no metafile mentioning it, a file may still be
  // bundled somewhere in that package, so it widens to every built file of the package.
  source: (file, pkg, outputsByInput) => {
    const outputs = outputsByInput.get(file) ?? [];
    const attributable = outputs.length > 0 && pkg?.metafiles !== undefined;

    return [file, ...outputs, ...(attributable ? [] : (pkg?.distFiles ?? []))];
  },
  asset: (_, pkg) => pkg?.testFiles ?? [],
};

function findPackage(packages: readonly BuiltPackage[], file: string) {
  return packages
    .filter(({ dir }) => file.startsWith(`${dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];
}

/**
 * Turn a diff into the inputs for `vitest related`: each changed source file plus the built dist
 * files that contain it, because tests in other packages import workspace packages through their
 * `dist` exports. Anything that cannot be narrowed soundly widens the selection instead.
 */
export function selectAffectedTests(
  changedFiles: readonly string[],
  packages: readonly BuiltPackage[]
): TestSelection {
  const outputsByInput = indexOutputsByInput(packages);
  const related = new Set<string>();

  for (const file of changedFiles) {
    const kind = classifyFile(file);

    if (kind === 'global') {
      return { kind: 'full' };
    }

    RELATED_FILES[kind](file, findPackage(packages, file), outputsByInput).forEach((path) =>
      related.add(path)
    );
  }

  return { kind: 'related', files: [...related].sort() };
}
