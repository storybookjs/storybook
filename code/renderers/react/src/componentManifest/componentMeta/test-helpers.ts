import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Resolve the real node_modules directory (may be hoisted to the workspace root). */
const NODE_MODULES_DIR = path.resolve(require.resolve('react/package.json'), '../..');

/** Copy the minimal node_modules packages TypeScript needs for React type resolution. */
function copyNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const typesSrc = path.join(NODE_MODULES_DIR, '@types');

  fs.mkdirSync(path.join(dest, '@types'), { recursive: true });

  for (const pkg of ['react', 'csstype']) {
    fs.cpSync(path.join(NODE_MODULES_DIR, pkg), path.join(dest, pkg), {
      recursive: true,
      dereference: true,
    });
  }

  for (const pkg of ['react', 'prop-types']) {
    fs.cpSync(path.join(typesSrc, pkg), path.join(dest, '@types', pkg), {
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
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
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
  fs.mkdirSync(dir, { recursive: true });
  copyNodeModules(dir);
  return dir;
}

export const DEFAULT_TSCONFIG = {
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
  fs.writeFileSync(configPath, JSON.stringify(tsconfig, null, 2));
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

/** Serialize a tsconfig to JSON, optionally merging overrides into `DEFAULT_TSCONFIG`. */
export function tsconfigJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...DEFAULT_TSCONFIG, ...overrides });
}

/** Best-effort cleanup of a temp directory. */
export function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}
