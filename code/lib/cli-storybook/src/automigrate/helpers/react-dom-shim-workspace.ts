import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { minVersion } from 'semver';
import { babelParse, traverse, types as t } from 'storybook/internal/babel';

import { analyzeReactDomShimConfig } from './react-dom-shim.ts';

const SHIM = '@storybook/react-dom-shim';
const MANIFEST = 'package.json';
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|mdx)$/;
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
type WorkspaceRoot = { directory: string; patterns: string[] };

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

const isShimSource = (value: string) => value === SHIM || value.startsWith(`${SHIM}/`);

const matchesPattern = (path: string, pattern: string): boolean => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\\0');
  const glob = escaped.replaceAll('*', '[^/]*').replaceAll('\\0', '.*');
  return new RegExp(`^${glob}$`).test(path);
};

const pnpmWorkspacePatterns = (source: string): string[] | undefined => {
  const lines = source.split('\n');
  const packagesIndex = lines.findIndex((line) => /^packages:\s*(?:#.*)?$/.test(line));
  if (packagesIndex === -1) return undefined;

  const patterns: string[] = [];
  for (const line of lines.slice(packagesIndex + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^\s+-\s+(?:['"]([^'"]+)['"]|([^\s#]+))\s*(?:#.*)?$/.exec(line);
    if (match) {
      patterns.push(match[1] ?? match[2]!);
      continue;
    }
    if (/^\S/.test(line)) break;
    return undefined;
  }
  return patterns.length ? patterns : undefined;
};

const staticString = (
  node: t.Node | t.Expression | t.SpreadElement | undefined
): string | undefined => {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

const isModuleLoad = (callee: t.CallExpression['callee']): boolean =>
  t.isImport(callee) ||
  t.isIdentifier(callee, { name: 'require' }) ||
  (t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object, { name: 'require' }) &&
    t.isIdentifier(callee.property, { name: 'resolve' }));

const sourceDiagnostic = (source: string, filePath: string): string | undefined => {
  try {
    let diagnostic: string | undefined;
    traverse(babelParse(source), {
      ImportDeclaration(path) {
        if (isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportNamedDeclaration(path) {
        if (path.node.source && isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportAllDeclaration(path) {
        if (isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      CallExpression(path) {
        if (!isModuleLoad(path.node.callee)) return;
        const [argument] = path.node.arguments;
        const value = staticString(argument);
        if (value && isShimSource(value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!value) diagnostic ??= `${filePath}: contains an unresolved module load`;
      },
      ImportExpression(path) {
        const value = staticString(path.node.source);
        if (value && isShimSource(value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!value) diagnostic ??= `${filePath}: contains an unresolved module load`;
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

const supportedWorkspaceRoot = async (
  projectDirectory: string
): Promise<WorkspaceRoot | undefined> => {
  let directory = resolve(projectDirectory);
  let fallback: string | undefined;
  while (true) {
    const manifestPath = join(directory, MANIFEST);
    const manifestSource = await reads(manifestPath);
    const manifest = manifestSource && parseManifest(manifestSource);
    if (manifestSource !== undefined && !manifest) return undefined;
    if (manifest) {
      fallback ??= directory;
      const patterns = workspacePatterns(manifest);
      if (patterns === undefined) return undefined;
      if (manifest.workspaces) return { directory, patterns };
    }

    const pnpmSource = await reads(join(directory, 'pnpm-workspace.yaml'));
    if (pnpmSource !== undefined && !pnpmWorkspacePatterns(pnpmSource)) return undefined;
    const pnpmPatterns = pnpmSource && pnpmWorkspacePatterns(pnpmSource);
    if (pnpmPatterns) return { directory, patterns: pnpmPatterns };

    const parent = dirname(directory);
    if (parent === directory) return fallback ? { directory: fallback, patterns: [] } : undefined;
    directory = parent;
  }
};

const dependencyRange = (manifest: Manifest, dependency: string): string | undefined =>
  DEPENDENCY_SECTIONS.map((section) => manifest[section]?.[dependency]).find(
    (range): range is string => range !== undefined
  );

const hasSupportedRange = (range: string | undefined): boolean => {
  if (!range) return false;
  try {
    return (minVersion(range)?.major ?? 0) >= 18;
  } catch {
    return false;
  }
};

const hasSupportedReact = (manifest: Manifest, rootManifest: Manifest): boolean =>
  hasSupportedRange(dependencyRange(manifest, 'react') ?? dependencyRange(rootManifest, 'react')) &&
  hasSupportedRange(
    dependencyRange(manifest, 'react-dom') ?? dependencyRange(rootManifest, 'react-dom')
  );

const manifestEdit = (filePath: string, source: string, manifest: Manifest): Edit => {
  for (const section of DEPENDENCY_SECTIONS) delete manifest[section]?.[SHIM];
  return { filePath, original: source, replacement: `${JSON.stringify(manifest, null, 2)}\n` };
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
  const { directory: workspaceRoot, patterns } = workspace;

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
  const manifestPaths = files.filter((filePath) => basename(filePath) === MANIFEST).sort();
  const pnpmWorkspacePaths = files
    .filter((filePath) => basename(filePath) === 'pnpm-workspace.yaml')
    .sort();
  const sources = files.filter((filePath) => SOURCE_FILE.test(filePath)).sort();
  const diagnostics: string[] = [];
  const manifests: Array<{ filePath: string; source: string; manifest: Manifest }> = [];
  const rootSource = await reads(join(workspaceRoot, MANIFEST));
  const rootManifest = rootSource && parseManifest(rootSource);
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
  for (const filePath of pnpmWorkspacePaths) {
    if (filePath !== join(workspaceRoot, 'pnpm-workspace.yaml')) {
      diagnostics.push(`${filePath}: nested workspace declarations are not supported`);
    }
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
    if (filePath !== join(workspaceRoot, MANIFEST) && !manifest.workspaces) {
      const path = relative(workspaceRoot, dirname(filePath)).split(sep).join('/');
      if (!patterns.some((pattern) => matchesPattern(path, pattern))) {
        diagnostics.push(`${filePath}: is outside the declared workspace packages`);
      }
    }
    manifests.push({ filePath, source, manifest });
  }

  const shimManifests = manifests.filter(({ manifest }) => hasShim(manifest));

  for (const item of shimManifests) {
    if (!rootManifest || !hasSupportedReact(item.manifest, rootManifest)) {
      diagnostics.push(`${item.filePath}: react and react-dom must both support React 18 or later`);
    }
  }

  const sourceEdits: Edit[] = [];
  for (const filePath of sources) {
    const source = await reads(filePath);
    if (source === undefined) {
      diagnostics.push(`${filePath}: cannot read source during workspace scan`);
      continue;
    }
    const sourceIssue = sourceDiagnostic(source, filePath);
    if (sourceIssue) {
      diagnostics.push(sourceIssue);
      continue;
    }
    if (!CONFIG_FILE.test(filePath)) {
      continue;
    }
    const owner = manifests
      .filter(({ filePath: manifestPath }) => {
        const packageDirectory = dirname(manifestPath);
        const path = relative(packageDirectory, filePath);
        return path && !path.startsWith(`..${sep}`) && path !== '..';
      })
      .sort((left, right) => right.filePath.length - left.filePath.length)[0];
    if (!owner || !rootManifest || !hasSupportedReact(owner.manifest, rootManifest)) {
      diagnostics.push(`${filePath}: react and react-dom must both support React 18 or later`);
      continue;
    }
    const analysis = analyzeReactDomShimConfig(source, filePath);
    if (analysis.kind === 'manual') {
      diagnostics.push(analysis.diagnostic);
    }
    if (analysis.kind === 'changed') {
      sourceEdits.push({ filePath, original: source, replacement: analysis.source });
    }
  }

  if (diagnostics.length) {
    return {
      kind: 'manual',
      workspaceRoot,
      diagnostics: diagnostics.sort(),
      manifests: manifestPaths,
      sources,
    };
  }
  if (!shimManifests.length && !sourceEdits.length) return { kind: 'none', workspaceRoot };
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
