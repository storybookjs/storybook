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

const GLOBAL_INPUTS = [
  /(^|\/)(package\.json|yarn\.lock|\.yarnrc[^/]*|nx\.json|\.nvmrc|tsconfig[^/]*\.json|vite(st)?[.-](config|workspace|shared|setup)[^/]*)$/,
  /^(\.yarn\/patches|code\/__mocks__)\//,
];

/** A change to a global input can affect any test, so it needs the full suite. */
export const isGlobalInput = (file: string) => GLOBAL_INPUTS.some((pattern) => pattern.test(file));

type FileKind = 'test' | 'source' | 'asset';

/** First match wins; a file matching no row is an asset. */
const FILE_KINDS: readonly (readonly [FileKind, RegExp])[] = [
  ['test', /\.(test|spec|test-d)\.[cm]?[jt]sx?$/],
  // Fixtures, mocks and snapshots reach tests through the file system or mock resolution, not imports.
  ['asset', /(^|\/)(__[^/]+__|fixtures)\//],
  ['source', /\.([cm]?[jt]sx?|vue|svelte)$/],
];

function classifyFile(file: string): FileKind {
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
  FileKind,
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
 * `dist` exports. Anything that cannot be narrowed soundly widens the selection instead. Global
 * inputs are not covered; callers check {@link isGlobalInput} first.
 */
export function selectAffectedTests(
  changedFiles: readonly string[],
  packages: readonly BuiltPackage[]
): string[] {
  const outputsByInput = indexOutputsByInput(packages);
  const related = new Set<string>();

  for (const file of changedFiles) {
    RELATED_FILES[classifyFile(file)](file, findPackage(packages, file), outputsByInput).forEach(
      (path) => related.add(path)
    );
  }

  return [...related].sort();
}
