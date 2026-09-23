import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { minVersion } from 'semver';
import { babelParse, traverse, types as t } from 'storybook/internal/babel';

import { analyzeReactDomShimConfig } from './react-dom-shim.ts';

const SHIM = '@storybook/react-dom-shim';
const MANIFEST = 'package.json';
const SKIPPED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules', 'storybook-static']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;
const CONFIG_FILE = /(^|[/\\])(?:main|vite(?:st)?\.config)\.[cm]?[jt]sx?$/;
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type DependencyMap = Record<string, string>;
type Manifest = {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  workspaces?: string[] | { packages?: string[] };
};

type Edit = { filePath: string; original: string; replacement: string };

export type ReactDomShimWorkspaceAnalysis =
  | { kind: 'none'; workspaceRoot: string }
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
    return JSON.parse(source) as Manifest;
  } catch {
    return undefined;
  }
};

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

const matchesPattern = (path: string, pattern: string): boolean => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '.*')
    .replaceAll('*', '[^/]*');
  return new RegExp(`^${escaped}$`).test(path);
};

const sourceDiagnostic = (source: string, filePath: string): string | undefined => {
  try {
    let diagnostic: string | undefined;
    traverse(babelParse(source), {
      ImportDeclaration(path) {
        if (path.node.source.value === SHIM)
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportNamedDeclaration(path) {
        if (path.node.source?.value === SHIM)
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportAllDeclaration(path) {
        if (path.node.source.value === SHIM)
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      CallExpression(path) {
        if (!t.isImport(path.node.callee) && !t.isIdentifier(path.node.callee, { name: 'require' }))
          return;
        const [argument] = path.node.arguments;
        if (t.isStringLiteral(argument) && argument.value === SHIM)
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!t.isStringLiteral(argument))
          diagnostic ??= `${filePath}: contains an unresolved module load`;
      },
      ImportExpression(path) {
        if (t.isStringLiteral(path.node.source) && path.node.source.value === SHIM)
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!t.isStringLiteral(path.node.source))
          diagnostic ??= `${filePath}: contains an unresolved module load`;
      },
      ObjectProperty(path) {
        if (CONFIG_FILE.test(filePath) && path.node.computed) {
          diagnostic ??= `${filePath}: contains computed configuration that cannot be removed safely`;
        }
      },
    });
    return diagnostic;
  } catch {
    return `${filePath}: cannot parse source during workspace scan`;
  }
};

const filePaths = async (directory: string): Promise<string[] | undefined> => {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return undefined;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const filePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) return undefined;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        const descendants = await filePaths(filePath);
        if (!descendants) return undefined;
        files.push(...descendants);
      }
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
};

const enclosingManifest = async (projectDirectory: string): Promise<string | undefined> => {
  let directory = resolve(projectDirectory);
  while (true) {
    const candidate = join(directory, MANIFEST);
    if (await reads(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
};

const supportedWorkspaceRoot = async (projectDirectory: string): Promise<string | undefined> => {
  let manifestPath = await enclosingManifest(projectDirectory);
  const projectManifestPath = manifestPath;
  while (manifestPath) {
    const source = await reads(manifestPath);
    const manifest = source && parseManifest(source);
    if (!manifest) return undefined;
    if (workspacePatterns(manifest) === undefined) return undefined;
    if (manifest.workspaces) return dirname(manifestPath);
    manifestPath = await enclosingManifest(dirname(dirname(manifestPath)));
  }
  return projectManifestPath ? dirname(projectManifestPath) : undefined;
};

const hasSupportedReact = (manifest: Manifest): boolean => {
  const react =
    manifest.dependencies?.react ??
    manifest.devDependencies?.react ??
    manifest.optionalDependencies?.react ??
    manifest.peerDependencies?.react;
  const reactDom =
    manifest.dependencies?.['react-dom'] ??
    manifest.devDependencies?.['react-dom'] ??
    manifest.optionalDependencies?.['react-dom'] ??
    manifest.peerDependencies?.['react-dom'];
  return Boolean(
    react &&
    reactDom &&
    minVersion(react)?.major &&
    minVersion(reactDom)?.major &&
    minVersion(react)!.major >= 18 &&
    minVersion(reactDom)!.major >= 18
  );
};

const manifestEdit = (filePath: string, source: string, manifest: Manifest): Edit => {
  for (const section of DEPENDENCY_SECTIONS) delete manifest[section]?.[SHIM];
  return { filePath, original: source, replacement: `${JSON.stringify(manifest, null, 2)}\n` };
};

export const analyzeReactDomShimWorkspace = async (
  projectDirectory: string
): Promise<ReactDomShimWorkspaceAnalysis> => {
  const workspaceRoot = await supportedWorkspaceRoot(projectDirectory);
  if (!workspaceRoot) {
    return {
      kind: 'manual',
      workspaceRoot: resolve(projectDirectory),
      diagnostics: [`${projectDirectory}: no supported package.json workspace root was found`],
      manifests: [],
      sources: [],
    };
  }

  const files = await filePaths(workspaceRoot);
  if (!files) {
    return {
      kind: 'manual',
      workspaceRoot,
      diagnostics: [`${workspaceRoot}: scan was incomplete`],
      manifests: [],
      sources: [],
    };
  }
  const manifestPaths = files.filter((filePath) => filePath.endsWith(`/${MANIFEST}`)).sort();
  const sources = files.filter((filePath) => SOURCE_FILE.test(filePath)).sort();
  const diagnostics: string[] = [];
  const manifests: Array<{ filePath: string; source: string; manifest: Manifest }> = [];
  const rootSource = await reads(join(workspaceRoot, MANIFEST));
  const rootManifest = rootSource && parseManifest(rootSource);
  const patterns = rootManifest && workspacePatterns(rootManifest);
  if (!rootManifest || !patterns)
    diagnostics.push(`${join(workspaceRoot, MANIFEST)}: unsupported workspace declaration`);
  if (
    patterns?.some(
      (pattern) =>
        pattern.startsWith('!') || pattern.startsWith('/') || pattern.split('/').includes('..')
    )
  ) {
    diagnostics.push(
      `${join(workspaceRoot, MANIFEST)}: has an unsupported external workspace pattern`
    );
  }

  for (const filePath of manifestPaths) {
    const source = await reads(filePath);
    const manifest = source && parseManifest(source);
    if (!source || !manifest) {
      diagnostics.push(`${filePath}: cannot read a valid package.json`);
      continue;
    }
    if (filePath !== join(workspaceRoot, MANIFEST) && manifest.workspaces) {
      diagnostics.push(`${filePath}: nested workspace declarations are not supported`);
    }
    if (filePath !== join(workspaceRoot, MANIFEST) && patterns && !manifest.workspaces) {
      const path = relative(workspaceRoot, dirname(filePath)).split(sep).join('/');
      if (!patterns.some((pattern) => matchesPattern(path, pattern))) {
        diagnostics.push(`${filePath}: is outside the declared workspace packages`);
      }
    }
    manifests.push({ filePath, source, manifest });
  }

  const shimManifests = manifests.filter(({ manifest }) => hasShim(manifest));

  for (const item of shimManifests) {
    if (!hasSupportedReact(item.manifest) && !(rootManifest && hasSupportedReact(rootManifest))) {
      diagnostics.push(`${item.filePath}: react and react-dom must both support React 18 or later`);
    }
  }

  const sourceEdits: Edit[] = [];
  const affectedSources: string[] = [];
  for (const filePath of sources) {
    const source = await reads(filePath);
    if (source === undefined) {
      diagnostics.push(`${filePath}: cannot read source during workspace scan`);
      continue;
    }
    const sourceIssue = sourceDiagnostic(source, filePath);
    if (sourceIssue) {
      affectedSources.push(filePath);
      diagnostics.push(sourceIssue);
      continue;
    }
    if (!CONFIG_FILE.test(filePath)) {
      continue;
    }
    const analysis = analyzeReactDomShimConfig(source, filePath);
    if (analysis.kind === 'manual') {
      affectedSources.push(filePath);
      diagnostics.push(analysis.diagnostic);
    }
    if (analysis.kind === 'changed') {
      affectedSources.push(filePath);
      sourceEdits.push({ filePath, original: source, replacement: analysis.source });
    }
  }

  if (diagnostics.length) {
    return {
      kind: 'manual',
      workspaceRoot,
      diagnostics: diagnostics.sort(),
      manifests: manifestPaths,
      sources: affectedSources.sort(),
    };
  }
  if (!shimManifests.length) return { kind: 'none', workspaceRoot };
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
