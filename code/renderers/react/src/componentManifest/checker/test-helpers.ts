/**
 * Shared test infrastructure for ComponentMetaProject / ComponentMetaManager /
 * componentMetaExtractor tests.
 *
 * These helpers avoid importing `node:fs` normally because the react vitest setup mocks it with
 * memfs, while `ts.sys` still points at the real filesystem. `process.getBuiltinModule()` gives us
 * the real builtin fs implementation for recursive copy/delete on disk.
 */
import type * as nodeFs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import ts from 'typescript';

/** Real `ts.sys` — unaffected by memfs mocks. */
export const sys = ts.sys;

/** Resolve the real node_modules directory (may be hoisted to the workspace root). */
const NODE_MODULES_DIR = path.resolve(require.resolve('react/package.json'), '../..');

const realFs = process.getBuiltinModule('node:fs') as typeof nodeFs;

/** Copy the minimal node_modules packages TypeScript needs for React type resolution. */
function copyNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const typesSrc = path.join(NODE_MODULES_DIR, '@types');

  realFs.mkdirSync(path.join(dest, '@types'), { recursive: true });

  for (const pkg of ['react', 'csstype']) {
    realFs.cpSync(path.join(NODE_MODULES_DIR, pkg), path.join(dest, pkg), {
      recursive: true,
      dereference: true,
    });
  }

  for (const pkg of ['react', 'prop-types']) {
    realFs.cpSync(path.join(typesSrc, pkg), path.join(dest, '@types', pkg), {
      recursive: true,
      dereference: true,
    });
  }
}

/** Write files into `baseDir`, creating nested directories as needed. Returns absolute paths. */
export function writeFiles(baseDir: string, files: Record<string, string>): Record<string, string> {
  const filePaths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(baseDir, name);
    const dir = path.dirname(filePath);
    if (!sys.directoryExists(dir)) {
      const parts = path.relative(baseDir, dir).split(path.sep);
      let current = baseDir;
      for (const part of parts) {
        current = path.join(current, part);
        if (!sys.directoryExists(current)) {
          sys.createDirectory(current);
        }
      }
    }
    sys.writeFile(filePath, content);
    filePaths[name] = filePath;
  }
  return filePaths;
}

/** Create a temp directory in os.tmpdir() with node_modules copied in. */
export function createTempDir(prefix = 'meta-test'): string {
  const dir = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  sys.createDirectory(dir);
  copyNodeModules(dir);
  return dir;
}

const DEFAULT_TSCONFIG = {
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    jsx: 'react-jsx',
    strict: true,
    esModuleInterop: true,
    moduleResolution: 'bundler',
  },
  include: ['./**/*.ts', './**/*.tsx'],
};

/**
 * Creates a temp project directory with node_modules, a tsconfig.json, and the given source files
 * written to disk.
 */
export function createTempProject(
  files: Record<string, string>,
  tsconfig: object = DEFAULT_TSCONFIG
): {
  projectDir: string;
  configPath: string;
  filePaths: Record<string, string>;
} {
  const projectDir = createTempDir('prop-ls-test');
  const configPath = path.join(projectDir, 'tsconfig.json');
  sys.writeFile(configPath, JSON.stringify(tsconfig, null, 2));
  const filePaths = writeFiles(projectDir, files);
  return { projectDir, configPath, filePaths };
}

/**
 * Derive a PascalCase component name from a file path. For `index.ts` files the parent directory
 * name is used instead.
 */
export function defaultImportName(filePath: string): string {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const rawName = baseName === 'index' ? path.basename(dir) : baseName;
  const pascalName = rawName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return pascalName || 'Component';
}

/** Best-effort cleanup of a temp directory. */
export function cleanup(dir: string): void {
  try {
    realFs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
