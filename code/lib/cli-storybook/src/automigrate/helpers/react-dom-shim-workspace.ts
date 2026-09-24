import { readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { minVersion } from 'semver';
import { analyzeReactDomShimData } from './react-dom-shim-data.ts';
import {
  inertFileDiagnostic,
  linkedScriptDiagnostic,
  pnpmWorkspaceDiagnostic,
  workspaceFileKind,
  workspaceFiles,
} from './react-dom-shim-file.ts';
import { analyzeReactDomShimHtml, htmlHasShimUse } from './react-dom-shim-html.ts';
import {
  matchesWorkspacePattern,
  pnpmWorkspacePatterns,
} from './react-dom-shim-workspace-patterns.ts';
import { analyzeReactDomShimConfig } from './react-dom-shim.ts';
import { sourceDiagnostic, sourceHasShimUse } from './react-dom-shim-source.ts';

const SHIM = '@storybook/react-dom-shim';
const MANIFEST = 'package.json';
const CONFIG_FILE = /(^|[/\\])(?:main|vite(?:st)?\.config)\.[cm]?[jt]sx?$/;
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type DependencyMap = Record<string, string>;
type JsonValue = boolean | JsonRecord | JsonValue[] | null | number | string;
interface JsonRecord {
  [key: string]: JsonValue;
}
type Manifest = {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  workspaces?: string[] | { packages?: string[] };
};

type Edit = { filePath: string; original: string; replacement: string };
type WorkspaceRoot = { directory: string; entryManifestPath?: string; patterns: string[] };
type ManifestItem = { filePath: string; source: string; manifest: Manifest };

export type ReactDomShimWorkspaceAnalysis =
  | { applicable: false; kind: 'none'; workspaceRoot: string }
  | { kind: 'safe'; workspaceRoot: string; edits: Edit[] }
  | {
      kind: 'manual';
      workspaceRoot: string;
      diagnostics: string[];
      manifests: string[];
      sources: string[];
    };

const reads = async (filePath: string): Promise<string | undefined> => {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
};

const parseManifest = (source: string): Manifest | undefined => {
  try {
    const manifest: JsonValue = JSON.parse(source);
    if (!isJsonRecord(manifest)) return undefined;
    if (!DEPENDENCY_SECTIONS.every((section) => isDependencyMap(manifest[section]))) {
      return undefined;
    }
    if (!isWorkspaceDeclaration(manifest.workspaces)) return undefined;
    return manifest as Manifest;
  } catch {
    return undefined;
  }
};

const isJsonRecord = (value: JsonValue | undefined): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDependencyMap = (value: JsonValue | undefined): boolean =>
  value === undefined ||
  (isJsonRecord(value) &&
    Object.values(value).every((dependency) => typeof dependency === 'string'));

const isWorkspaceDeclaration = (value: JsonValue | undefined): boolean =>
  value === undefined ||
  (Array.isArray(value) && value.every((pattern) => typeof pattern === 'string')) ||
  (isJsonRecord(value) &&
    (value.packages === undefined ||
      (Array.isArray(value.packages) &&
        value.packages.every((pattern) => typeof pattern === 'string'))));

const workspacePatterns = (manifest: Manifest): string[] | undefined => {
  if (!manifest.workspaces) return [];
  if (
    Array.isArray(manifest.workspaces) &&
    manifest.workspaces.every((item) => typeof item === 'string')
  ) {
    return manifest.workspaces;
  }
  if (
    !Array.isArray(manifest.workspaces) &&
    Array.isArray(manifest.workspaces.packages) &&
    manifest.workspaces.packages.every((item) => typeof item === 'string')
  ) {
    return manifest.workspaces.packages;
  }
  return undefined;
};

const hasShim = (manifest: Manifest): boolean =>
  DEPENDENCY_SECTIONS.some((section) => Boolean(manifest[section]?.[SHIM]));

const hasJsonShimReference = (value: JsonValue): boolean => {
  if (typeof value === 'string') return value.includes(SHIM);
  if (Array.isArray(value)) return value.some(hasJsonShimReference);
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.entries(value).some(
      ([key, nestedValue]) => key.includes(SHIM) || hasJsonShimReference(nestedValue)
    )
  );
};

const hasManifestShimReference = (manifest: Manifest): boolean =>
  Object.entries(manifest).some(([key, value]) => {
    if (!DEPENDENCY_SECTIONS.some((section) => section === key)) return hasJsonShimReference(value);
    return (
      isJsonRecord(value) &&
      Object.entries(value).some(
        ([dependency, range]) =>
          dependency !== SHIM &&
          (dependency.includes(SHIM) || (typeof range === 'string' && range.includes(SHIM)))
      )
    );
  });

const supportedWorkspaceRoot = async (
  projectDirectory: string
): Promise<WorkspaceRoot | undefined> => {
  let directory = resolve(projectDirectory);
  let fallback: string | undefined;
  let entryManifestPath: string | undefined;
  while (true) {
    const manifestPath = join(directory, MANIFEST);
    const manifestSource = await reads(manifestPath);
    const manifest = manifestSource && parseManifest(manifestSource);
    if (manifestSource !== undefined && !manifest) return undefined;
    if (manifest) {
      fallback ??= directory;
      entryManifestPath ??= manifestPath;
      const patterns = workspacePatterns(manifest);
      if (patterns === undefined) return undefined;
      if (manifest.workspaces) return { directory, entryManifestPath, patterns };
    }

    const pnpmSource = await reads(join(directory, 'pnpm-workspace.yaml'));
    if (pnpmSource !== undefined && !pnpmWorkspacePatterns(pnpmSource)) return undefined;
    const pnpmPatterns = pnpmSource && pnpmWorkspacePatterns(pnpmSource);
    if (pnpmPatterns) return { directory, entryManifestPath, patterns: pnpmPatterns };

    const parent = dirname(directory);
    if (parent === directory) {
      return fallback ? { directory: fallback, entryManifestPath, patterns: [] } : undefined;
    }
    directory = parent;
  }
};

const dependencyRanges = (manifest: Manifest, dependency: string): string[] =>
  DEPENDENCY_SECTIONS.flatMap((section) => {
    const range = manifest[section]?.[dependency];
    return range === undefined ? [] : [range];
  });

const hasSupportedRange = (range: string | undefined): boolean => {
  if (!range) return false;
  try {
    return (minVersion(range)?.major ?? 0) >= 18;
  } catch {
    return false;
  }
};

const hasSupportedReact = (manifest: Manifest, rootManifest: Manifest): boolean =>
  [dependencyRanges(manifest, 'react'), dependencyRanges(manifest, 'react-dom')].every(
    (ranges, index) => {
      const fallback = dependencyRanges(rootManifest, index === 0 ? 'react' : 'react-dom');
      const effectiveRanges = ranges.length ? ranges : fallback;
      return effectiveRanges.length > 0 && effectiveRanges.every(hasSupportedRange);
    }
  );

const manifestEdit = (filePath: string, source: string, manifest: Manifest): Edit => {
  for (const section of DEPENDENCY_SECTIONS) delete manifest[section]?.[SHIM];
  return { filePath, original: source, replacement: `${JSON.stringify(manifest, null, 2)}\n` };
};

const inspectPnpmWorkspaces = async (workspaceRoot: string, filePaths: string[]) => {
  const diagnostics: string[] = [];
  let hasShimReference = false;
  for (const filePath of filePaths) {
    const source = await reads(filePath);
    if (source === undefined) {
      diagnostics.push(`${filePath}: cannot read pnpm workspace metadata during workspace scan`);
    } else {
      hasShimReference ||= source.includes(SHIM);
      const diagnostic = pnpmWorkspaceDiagnostic(source, filePath);
      if (diagnostic) diagnostics.push(diagnostic);
    }
    if (filePath !== join(workspaceRoot, 'pnpm-workspace.yaml')) {
      diagnostics.push(`${filePath}: nested workspace declarations are not supported`);
    }
  }
  return { diagnostics, hasShimReference };
};

const manifestWorkspaceDiagnostic = (
  item: ManifestItem,
  workspaceRoot: string,
  patterns: string[]
) => {
  const rootManifestPath = join(workspaceRoot, MANIFEST);
  if (item.filePath === rootManifestPath) return undefined;
  if (item.manifest.workspaces) {
    return `${item.filePath}: nested workspace declarations are not supported`;
  }
  const path = relative(workspaceRoot, dirname(item.filePath)).split(sep).join('/');
  return patterns.some((pattern) => matchesWorkspacePattern(path, pattern))
    ? undefined
    : `${item.filePath}: is outside the declared workspace packages`;
};

const inspectManifests = async (
  workspaceRoot: string,
  patterns: string[],
  manifestPaths: string[]
) => {
  const diagnostics: string[] = [];
  const manifests: ManifestItem[] = [];
  for (const filePath of manifestPaths) {
    const source = await reads(filePath);
    const manifest = source && parseManifest(source);
    if (!source || !manifest) {
      diagnostics.push(`${filePath}: cannot read a valid package.json`);
      continue;
    }
    const item = { filePath, source, manifest };
    const workspaceDiagnostic = manifestWorkspaceDiagnostic(item, workspaceRoot, patterns);
    if (workspaceDiagnostic) diagnostics.push(workspaceDiagnostic);
    if (hasManifestShimReference(manifest)) {
      diagnostics.push(
        `${filePath}: contains a react-dom-shim reference that cannot be removed safely`
      );
    }
    manifests.push(item);
  }
  return { diagnostics, manifests };
};

const hasApplicableSource = async (filePaths: string[]) => {
  for (const filePath of filePaths) {
    const source = await reads(filePath);
    if (source === undefined) continue;
    const kind = workspaceFileKind(filePath);
    if (sourceHasShimUse(source, filePath)) return true;
    if (
      kind === 'html' &&
      htmlHasShimUse(source, (content) => sourceHasShimUse(content, filePath))
    ) {
      return true;
    }
    if (
      CONFIG_FILE.test(filePath) &&
      analyzeReactDomShimConfig(source, filePath).kind === 'changed'
    ) {
      return true;
    }
  }
  return false;
};

const styleDiagnostics = async (files: string[]) => {
  const diagnostics: string[] = [];
  for (const filePath of files.filter((path) => /\.s?css$/.test(path))) {
    const source = await reads(filePath);
    if (source === undefined) {
      diagnostics.push(`${filePath}: cannot read inert file during workspace scan`);
    } else {
      const diagnostic = inertFileDiagnostic(source, filePath);
      if (diagnostic) diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
};

const workspaceSourceIssue = (
  source: string,
  filePath: string,
  workspaceRoot: string,
  files: string[]
) => {
  const kind = workspaceFileKind(filePath);
  if (kind === 'astro') {
    return `${filePath}: cannot prove absence in Astro source during workspace scan`;
  }
  if (kind === 'html') {
    return analyzeReactDomShimHtml(
      source,
      filePath,
      sourceDiagnostic,
      analyzeReactDomShimData,
      (scriptSource, htmlPath) =>
        linkedScriptDiagnostic(scriptSource, htmlPath, workspaceRoot, files)
    );
  }
  if (kind === 'data') return analyzeReactDomShimData(source, filePath);
  if (kind === 'manual') return `${filePath}: unsupported file type cannot be scanned safely`;
  return sourceDiagnostic(source, filePath);
};

const owningManifest = (filePath: string, manifests: ManifestItem[]) =>
  manifests
    .filter(({ filePath: manifestPath }) => {
      const packageDirectory = dirname(manifestPath);
      const path = relative(packageDirectory, filePath);
      return path && !path.startsWith(`..${sep}`) && path !== '..';
    })
    .sort((left, right) => right.filePath.length - left.filePath.length)[0];

const analyzeSources = async ({
  diagnostics,
  files,
  manifests,
  rootManifest,
  sources,
  workspaceRoot,
}: {
  diagnostics: string[];
  files: string[];
  manifests: ManifestItem[];
  rootManifest: Manifest | undefined;
  sources: string[];
  workspaceRoot: string;
}) => {
  const edits: Edit[] = [];
  for (const filePath of sources) {
    const source = await reads(filePath);
    if (source === undefined) {
      diagnostics.push(`${filePath}: cannot read source during workspace scan`);
      continue;
    }
    const issue = workspaceSourceIssue(source, filePath, workspaceRoot, files);
    if (issue) {
      diagnostics.push(issue);
      continue;
    }
    if (!CONFIG_FILE.test(filePath)) continue;
    const analysis = analyzeReactDomShimConfig(source, filePath);
    if (analysis.kind === 'manual') {
      diagnostics.push(analysis.diagnostic);
      continue;
    }
    if (analysis.kind === 'unchanged') continue;
    const owner = owningManifest(filePath, manifests);
    if (!owner || !rootManifest || !hasSupportedReact(owner.manifest, rootManifest)) {
      diagnostics.push(`${filePath}: react and react-dom must both support React 18 or later`);
      continue;
    }
    edits.push({ filePath, original: source, replacement: analysis.source });
  }
  return edits;
};

export const analyzeReactDomShimWorkspace = async (
  projectDirectory: string
): Promise<ReactDomShimWorkspaceAnalysis> => {
  const workspace = await supportedWorkspaceRoot(projectDirectory);
  if (!workspace) {
    return {
      kind: 'manual',
      workspaceRoot: resolve(projectDirectory),
      diagnostics: [`${projectDirectory}: no supported package.json workspace root was found`],
      manifests: [],
      sources: [],
    };
  }
  const { directory: workspaceRoot, entryManifestPath, patterns } = workspace;

  const scan = await workspaceFiles(workspaceRoot);
  const { files } = scan;
  const manifestPaths = [
    ...new Set([
      ...files.filter((filePath) => basename(filePath) === MANIFEST),
      ...(entryManifestPath ? [entryManifestPath] : []),
    ]),
  ].sort();
  const pnpmWorkspacePaths = files
    .filter((filePath) => basename(filePath) === 'pnpm-workspace.yaml')
    .sort();
  const sources = files
    .filter(
      (filePath) => basename(filePath) !== MANIFEST && workspaceFileKind(filePath) !== 'inert'
    )
    .sort();
  const diagnostics: string[] = [];
  const rootSource = await reads(join(workspaceRoot, MANIFEST));
  const rootManifest = rootSource ? parseManifest(rootSource) : undefined;
  if (!rootManifest)
    diagnostics.push(`${join(workspaceRoot, MANIFEST)}: unsupported workspace declaration`);
  if (
    patterns.some(
      (pattern) =>
        pattern.startsWith('!') || pattern.startsWith('/') || pattern.split('/').includes('..')
    )
  ) {
    diagnostics.push(
      `${join(workspaceRoot, MANIFEST)}: has an unsupported external workspace pattern`
    );
  }
  const pnpmInspection = await inspectPnpmWorkspaces(workspaceRoot, pnpmWorkspacePaths);
  diagnostics.push(...pnpmInspection.diagnostics);
  const manifestInspection = await inspectManifests(workspaceRoot, patterns, manifestPaths);
  diagnostics.push(...manifestInspection.diagnostics);
  const { manifests } = manifestInspection;
  const shimManifests = manifests.filter(({ manifest }) => hasShim(manifest));
  const applicable =
    shimManifests.length > 0 ||
    pnpmInspection.hasShimReference ||
    manifests.some(({ manifest }) => hasManifestShimReference(manifest)) ||
    (await hasApplicableSource(sources));
  if (!applicable) return { applicable: false, kind: 'none', workspaceRoot };
  if (!scan.complete) {
    return {
      kind: 'manual',
      workspaceRoot,
      diagnostics: [
        ...shimManifests.map(
          ({ filePath }) =>
            `${filePath}: declares @storybook/react-dom-shim and requires manual migration`
        ),
        `${workspaceRoot}: scan was incomplete`,
      ],
      manifests: manifestPaths,
      sources,
    };
  }

  for (const item of shimManifests) {
    if (!rootManifest || !hasSupportedReact(item.manifest, rootManifest)) {
      diagnostics.push(`${item.filePath}: react and react-dom must both support React 18 or later`);
    }
  }

  diagnostics.push(...(await styleDiagnostics(files)));
  const sourceEdits = await analyzeSources({
    diagnostics,
    files,
    manifests,
    rootManifest,
    sources,
    workspaceRoot,
  });

  if (diagnostics.length) {
    return {
      kind: 'manual',
      workspaceRoot,
      diagnostics: diagnostics.sort(),
      manifests: manifestPaths,
      sources,
    };
  }
  if (!shimManifests.length && !sourceEdits.length) {
    return { applicable: false, kind: 'none', workspaceRoot };
  }
  return {
    kind: 'safe',
    workspaceRoot,
    edits: [
      ...sourceEdits,
      ...shimManifests.map(({ filePath, source, manifest }) =>
        manifestEdit(filePath, source, manifest)
      ),
    ].sort((left, right) => left.filePath.localeCompare(right.filePath)),
  };
};
