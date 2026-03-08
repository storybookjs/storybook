/**
 * Shared test infrastructure for ComponentMetaProject / ComponentMetaManager /
 * componentMetaExtractor tests.
 *
 * All helpers use `ts.sys` for file I/O because the react vitest setup mocks `node:fs` with memfs,
 * but `ts.sys` uses the real filesystem (it imported fs before mocks were applied).
 */
import { execSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

import ts from 'typescript';

/** Real `ts.sys` — unaffected by memfs mocks. */
export const sys = ts.sys;

/** Resolve the real node_modules directory (may be hoisted to the workspace root). */
const NODE_MODULES_DIR = path.resolve(require.resolve('react/package.json'), '../..');

/** Copy the minimal node_modules packages TypeScript needs for React type resolution. */
function copyNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const typesSrc = path.join(NODE_MODULES_DIR, '@types');
  execSync(`mkdir -p "${dest}/@types"`);
  for (const pkg of ['react', 'csstype']) {
    execSync(`cp -rL "${path.join(NODE_MODULES_DIR, pkg)}" "${path.join(dest, pkg)}"`);
  }
  for (const pkg of ['react', 'prop-types']) {
    execSync(`cp -rL "${path.join(typesSrc, pkg)}" "${path.join(dest, '@types', pkg)}"`);
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

/** Best-effort cleanup of a temp directory. */
export function cleanup(dir: string): void {
  try {
    execSync(`rm -rf "${dir}"`);
  } catch {
    // best-effort cleanup
  }
}
