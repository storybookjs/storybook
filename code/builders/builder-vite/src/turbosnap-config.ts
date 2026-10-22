import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { findConfigFile, resolvePackageDir, versions } from 'storybook/internal/common';
import { type ESTree, parseExpression, parseModule, walk } from 'storybook/internal/csf-tools';
import type { Options } from 'storybook/internal/types';

import { dirname, extname, isAbsolute, join, relative, resolve } from 'pathe';
import { version as viteVersion } from 'vite';

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export interface TurbosnapConfig {
  version: 1;
  builder: { name: '@storybook/builder-vite'; version: string; viteVersion: string };
  status: 'complete' | 'incomplete';
  reason: string;
  projectRoot: string;
  configDir: string;
  modulesHash: string;
  environmentHash: string;
  configFiles: string[];
  absentFiles: string[];
  files: Record<string, { hash: string; realPath: string; dependencies: string[] }>;
  roots: string[];
}

const sourcePattern = /\.[cm]?[jt]sx?$/;
const configExtensions = ['js', 'ts', 'mjs', 'cjs', 'mts', 'cts'];
const styleConfigs = [
  ...configExtensions.map((extension) => `postcss.config.${extension}`),
  '.postcssrc',
  '.postcssrc.json',
  '.postcssrc.yaml',
  '.postcssrc.yml',
  ...configExtensions.map((extension) => `.postcssrc.${extension}`),
  ...configExtensions.map((extension) => `babel.config.${extension}`),
  '.babelrc',
  '.babelrc.json',
  '.babelrc.js',
  '.babelrc.cjs',
];
const controlNames = [
  ...configExtensions.map((extension) => `vite.config.${extension}`),
  ...styleConfigs,
  'tsconfig.json',
  'jsconfig.json',
  'package.json',
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'bun.lock',
  'bun.lockb',
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
];

export const digest = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

function object(value: Value | undefined): value is { [key: string]: Value } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function literal(
  node: ESTree.Node | null | undefined,
  bindings = new Map<string, Value>()
): Value | undefined {
  if (!node) return undefined;
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression'
  ) {
    return literal(node.expression, bindings);
  }
  if (node.type === 'Identifier') return bindings.get(node.name);
  if (node.type === 'Literal') {
    return typeof node.value === 'string' ||
      typeof node.value === 'number' ||
      typeof node.value === 'boolean' ||
      node.value === null
      ? node.value
      : undefined;
  }
  if (node.type === 'ArrayExpression') {
    const values = node.elements.map((element) => literal(element, bindings));
    return values.every((value): value is Value => value !== undefined) ? values : undefined;
  }
  if (node.type === 'ObjectExpression') {
    const entries: [string, Value][] = [];
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.method ||
        property.kind !== 'init'
      )
        return undefined;
      const key = property.key.type === 'Identifier' ? property.key.name : literal(property.key);
      const value = literal(property.value, bindings);
      if (typeof key !== 'string' || value === undefined) return undefined;
      entries.push([key, value]);
    }
    return Object.fromEntries(entries);
  }
  return undefined;
}

function supportedMain(source: string, file: string): boolean {
  const bindings = new Map<string, Value>();
  let config: Value | undefined;
  for (const statement of parseModule(source, file).program.body) {
    if (statement.type === 'ImportDeclaration' && statement.importKind === 'type') continue;
    if (statement.type === 'TSTypeAliasDeclaration' || statement.type === 'TSInterfaceDeclaration')
      continue;
    if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
      for (const declaration of statement.declarations) {
        const value = literal(declaration.init, bindings);
        if (declaration.id.type !== 'Identifier' || value === undefined) return false;
        bindings.set(declaration.id.name, value);
      }
    } else if (statement.type === 'ExportDefaultDeclaration') {
      config = literal(statement.declaration, bindings);
    } else return false;
  }
  if (
    !object(config) ||
    Object.keys(config).some(
      (key) => !['framework', 'stories', 'staticDirs', 'addons', 'tags'].includes(key)
    )
  )
    return false;
  const framework = object(config.framework) ? config.framework.name : config.framework;
  if (framework !== '@storybook/html-vite') return false;
  if (
    object(config.framework) &&
    Object.keys(config.framework).some((key) => key !== 'name' && key !== 'options')
  )
    return false;
  if (
    object(config.framework) &&
    config.framework.options !== undefined &&
    (!object(config.framework.options) || Object.keys(config.framework.options).length > 0)
  )
    return false;
  return (
    (config.addons === undefined || (Array.isArray(config.addons) && config.addons.length === 0)) &&
    (config.staticDirs === undefined ||
      (Array.isArray(config.staticDirs) && config.staticDirs.length === 0))
  );
}

export interface ConfigEvidenceInput {
  workingDir: string;
  configDir: string;
  mainFile: string;
  presetFiles: string[];
  supportedPresetFiles: string[];
  compilerFiles: { esbuild: string; rollup: string };
  customCompiler?: boolean;
}

export class ConfigEvidence {
  private readonly projectRoot: string;
  private readonly files = new Map<
    string,
    { hash: string; realPath: string; dependencies: Set<string> }
  >();
  private readonly roots = new Set<string>();
  private readonly absent = new Set<string>();
  private readonly checkedDirectories = new Set<string>();
  private readonly initialConfig: string[] = [];
  private readonly initialHashes = new Map<string, string>();
  private reason: string | undefined;
  private environmentHash = '';

  constructor(private readonly input: ConfigEvidenceInput) {
    this.projectRoot = resolve(input.configDir, '..');
    try {
      this.initialConfig = this.listConfig(input.configDir);
      for (const file of this.initialConfig) {
        this.addFile(file);
        this.initialHashes.set(file, digest(readFileSync(file)));
        if (!sourcePattern.test(file) && extname(file) !== '.json') this.roots.add(file);
        if (extname(file) === '.html') this.reject('opaque-html-input');
      }
      this.roots.add(input.mainFile);
      if (!supportedMain(readFileSync(input.mainFile, 'utf8'), input.mainFile))
        this.reject('unsupported-main-config');
      const supported = new Set(input.supportedPresetFiles.map((file) => resolve(file)));
      if (
        input.presetFiles.length === 0 ||
        input.presetFiles.some((file) => !supported.has(resolve(file)))
      )
        this.reject('unsupported-preset');
      for (const file of input.presetFiles) {
        this.addFile(file);
        this.roots.add(file);
      }
      for (const [name, file] of Object.entries(input.compilerFiles)) {
        this.addFile(file);
        this.roots.add(file);
        const expected = name === 'esbuild' ? '0.28.1' : '4.53.2';
        if (JSON.parse(readFileSync(file, 'utf8')).version !== expected)
          this.reject('unsupported-compiler-version');
      }
      if (input.customCompiler) this.reject('custom-compiler');
      this.inspectControls(input.configDir);
      this.inspectControls(input.workingDir);
      for (const file of this.initialConfig) this.inspectControls(dirname(file));
      if (viteVersion !== '7.3.6') this.reject('unsupported-vite-version');
    } catch {
      this.reject('unreadable-build-input');
    }
  }

  reject(reason: string) {
    this.reason ??= reason;
  }

  get eligible() {
    return this.reason === undefined;
  }

  resolved(config: {
    root: string;
    mode: string;
    configFile: string | false | undefined;
    env: Record<string, unknown>;
    define?: Record<string, unknown>;
    css: { preprocessorOptions?: object };
    resolve?: { preserveSymlinks?: boolean };
    publicDir?: string | false;
  }) {
    try {
      this.environmentHash = digest(
        JSON.stringify({ env: sorted(config.env), define: sorted(config.define ?? {}) })
      );
      if (
        resolve(config.root) !== this.projectRoot ||
        config.mode !== 'production' ||
        config.configFile ||
        config.resolve?.preserveSymlinks
      )
        this.reject('unsupported-vite-config');
      if (config.css.preprocessorOptions && Object.keys(config.css.preprocessorOptions).length > 0)
        this.reject('unsupported-style-config');
      if (config.publicDir) {
        if (existsSync(config.publicDir)) this.reject('unsupported-static-input');
        else this.absent.add(config.publicDir);
      }
    } catch {
      this.reject('unsupported-vite-config');
    }
  }

  module(id: string) {
    if (!this.eligible || id.startsWith('\0') || !isAbsolute(id)) return;
    const file = id.split('?')[0];
    const packageFile = file.includes('/node_modules/') && !this.initialConfig.includes(file);
    try {
      if (!packageFile) this.inspectControls(dirname(file));
      // Storybook generates this entry and Vite's inline HTML proxy without a source file.
      if (
        file === join(this.projectRoot, 'iframe.html') &&
        !existsSync(file) &&
        (id === file || id === `${file}?html-proxy&inline-css&index=0.css`)
      )
        return;
      if (id.includes('?')) {
        this.reject('unsupported-runtime-query');
        return;
      }
      if (!existsSync(file)) {
        this.reject('missing-runtime-input');
        return;
      }
      if (!sourcePattern.test(file) && extname(file) !== '.json') {
        this.reject('unsupported-runtime-input');
        return;
      }
      if (sourcePattern.test(file)) {
        walk(parseModule(readFileSync(file, 'utf8'), file).program, (node, parent) => {
          const productionHotReference =
            parent?.type === 'MemberExpression' &&
            !parent.computed &&
            parent.property.type === 'Identifier' &&
            parent.property.name === 'hot';
          // Vite 7.3.6 excludes node_modules from dynamic-import expansion, and Storybook only
          // extracts build-time mock redirects from the project's preview configuration.
          if (
            (node.type === 'MetaProperty' &&
              node.meta.name === 'import' &&
              !productionHotReference) ||
            (!packageFile &&
              ((node.type === 'ImportExpression' && node.source.type !== 'Literal') ||
                (node.type === 'MemberExpression' &&
                  ((node.property.type === 'Identifier' && node.property.name === 'mock') ||
                    (node.property.type === 'Literal' && node.property.value === 'mock')))))
          )
            this.reject('opaque-runtime-input');
        });
      }
    } catch {
      this.reject('unreadable-build-input');
    }
  }

  finish(modules: { name: string; reasons?: { moduleName: string }[] }[]): TurbosnapConfig {
    try {
      const current = this.listConfig(this.input.configDir);
      if (
        JSON.stringify(current) !== JSON.stringify(this.initialConfig) ||
        current.some((file) => digest(readFileSync(file)) !== this.initialHashes.get(file))
      )
        this.reject('inputs-changed-during-build');
      if (!this.environmentHash) this.reject('missing-resolved-config');
      const annotations = '/virtual:/@storybook/builder-vite/project-annotations.js';
      if (
        !modules.some((module) => module.name === annotations) ||
        !modules.some((module) =>
          module.reasons?.some((reason) => reason.moduleName === annotations)
        )
      )
        this.reject('missing-preview-composition');
      if ([...this.files].some(([file, value]) => digest(readFileSync(file)) !== value.hash))
        this.reject('inputs-changed-during-build');
      if ([...this.absent].some((file) => existsSync(file)))
        this.reject('inputs-changed-during-build');
    } catch {
      this.reject('unreadable-build-input');
    }
    const key = (file: string) => {
      const value = relative(this.input.workingDir, file);
      return value.startsWith('../') ? value : `./${value}`;
    };
    return {
      version: 1,
      builder: {
        name: '@storybook/builder-vite',
        version: versions['@storybook/builder-vite'],
        viteVersion,
      },
      status: this.reason ? 'incomplete' : 'complete',
      reason: this.reason ?? 'supported-html-vite-pipeline',
      projectRoot: key(this.projectRoot),
      configDir: key(this.input.configDir),
      modulesHash: digest(JSON.stringify(modules)),
      environmentHash: this.environmentHash,
      configFiles: this.initialConfig.map(key).sort(),
      absentFiles: [...this.absent].map(key).sort(),
      files: Object.fromEntries(
        [...this.files]
          .map(([file, value]) => [
            key(file),
            {
              hash: value.hash,
              realPath: key(value.realPath),
              dependencies: [...value.dependencies].map(key).sort(),
            },
          ])
          .sort(([left], [right]) => String(left).localeCompare(String(right)))
      ),
      roots: [...this.roots]
        .filter((file) => this.files.has(file))
        .map(key)
        .sort(),
    };
  }

  private listConfig(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const file = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          this.reject('symlinked-config-input');
          return [];
        }
        return entry.isDirectory() ? this.listConfig(file) : entry.isFile() ? [file] : [];
      })
      .sort();
  }

  private addFile(file: string) {
    if (this.files.has(file)) return;
    const realPath = realpathSync(file);
    if (resolve(realPath) !== resolve(file)) this.reject('symlinked-config-input');
    this.files.set(file, { hash: digest(readFileSync(file)), realPath, dependencies: new Set() });
  }

  private inspectControls(start: string) {
    for (
      let directory = start;
      !this.checkedDirectories.has(directory);
      directory = dirname(directory)
    ) {
      this.checkedDirectories.add(directory);
      for (const name of controlNames) {
        const file = join(directory, name);
        if (!existsSync(file)) {
          this.absent.add(file);
          continue;
        }
        this.addFile(file);
        this.roots.add(file);
        if (styleConfigs.includes(name)) this.reject('unsupported-style-config');
        if (name.startsWith('vite.config.')) this.reject('custom-vite-config');
        if (name === 'tsconfig.json' || name === 'jsconfig.json')
          this.readTsconfig(file, new Set());
        if (name === 'package.json') {
          const value = JSON.parse(readFileSync(file, 'utf8'));
          if ('postcss' in value || 'babel' in value) this.reject('unsupported-style-config');
        }
      }
      if (dirname(directory) === directory) break;
    }
  }

  private readTsconfig(file: string, visited: Set<string>) {
    if (visited.has(file)) {
      this.reject('cyclic-tsconfig');
      return;
    }
    visited.add(file);
    const config = literal(parseExpression(readFileSync(file, 'utf8')));
    if (!object(config)) {
      this.reject('unsupported-tsconfig');
      return;
    }
    if (config.references !== undefined) this.reject('unsupported-tsconfig');
    const entries =
      config.extends === undefined
        ? []
        : Array.isArray(config.extends)
          ? config.extends
          : [config.extends];
    for (const entry of entries) {
      if (typeof entry !== 'string' || !entry.startsWith('.') || extname(entry) !== '.json') {
        this.reject('unsupported-tsconfig');
        continue;
      }
      const dependency = resolve(dirname(file), entry);
      if (!existsSync(dependency)) {
        this.absent.add(dependency);
        this.reject('unresolved-tsconfig');
        continue;
      }
      this.addFile(dependency);
      this.files.get(file)?.dependencies.add(dependency);
      this.readTsconfig(dependency, new Set(visited));
    }
  }
}

function sorted(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

async function collectConfigEvidence(options: Options): Promise<ConfigEvidence | undefined> {
  const mainFile = findConfigFile('main', options.configDir);
  if (!mainFile) return undefined;
  const presetFiles = await options.presets.apply<string[]>(
    'experimental_turbosnapPresetFiles',
    [],
    options
  );
  const supportedPresetFiles = [
    'storybook/internal/core-server/presets/common-override-preset',
    '@storybook/builder-vite/preset',
    '@storybook/html/preset',
    '@storybook/html-vite/preset',
  ].flatMap((specifier) => {
    try {
      return [fileURLToPath(import.meta.resolve(specifier))];
    } catch {
      return [];
    }
  });
  const viteRequire = createRequire(import.meta.resolve('vite/package.json'));
  return new ConfigEvidence({
    workingDir: process.cwd(),
    configDir: resolve(options.configDir),
    mainFile: resolve(mainFile),
    presetFiles: presetFiles.map((file) => {
      if (file.startsWith('file:')) return fileURLToPath(file);
      if (isAbsolute(file)) return file;
      try {
        return fileURLToPath(import.meta.resolve(file));
      } catch {
        return file;
      }
    }),
    supportedPresetFiles: [
      ...supportedPresetFiles,
      join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-preset.js'),
      resolve(mainFile),
    ],
    compilerFiles: {
      esbuild: viteRequire.resolve('esbuild/package.json'),
      rollup: viteRequire.resolve('rollup/package.json'),
    },
    customCompiler: Boolean(process.env.ESBUILD_BINARY_PATH),
  });
}

export async function createConfigEvidence(options: Options): Promise<ConfigEvidence | undefined> {
  try {
    return await collectConfigEvidence(options);
  } catch {
    // Missing evidence preserves consumers' existing conservative behavior.
    return undefined;
  }
}
