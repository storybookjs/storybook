import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(POC_DIR, '..', '..');
export const isWindows = process.platform === 'win32';

/** Resolves a package the way the repo does, from the repo root or from a given workspace. */
export function requireFrom(workspace = '.') {
  return createRequire(path.join(REPO_ROOT, workspace, 'package.json'));
}

export async function importFrom(specifier, workspace = '.') {
  const resolved = requireFrom(workspace).resolve(specifier);
  return import(new URL(`file:///${resolved.replace(/\\/g, '/').replace(/^\//, '')}`).href);
}

export function packageVersion(name, workspace = '.') {
  const require = requireFrom(workspace);
  try {
    return require(`${name}/package.json`).version;
  } catch {
    // Packages whose `exports` hide package.json: walk up from the resolved entry.
    try {
      let dir = path.dirname(require.resolve(name));
      while (dir !== path.dirname(dir)) {
        const candidate = path.join(dir, 'package.json');
        if (existsSync(candidate)) {
          const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
          if (pkg.name === name) return pkg.version;
        }
        dir = path.dirname(dir);
      }
    } catch {}
    return null;
  }
}

/** Classifies a path string by the separators it contains. */
export function separatorStyle(value) {
  if (typeof value !== 'string') return 'not-a-string';
  const back = value.includes('\\');
  const forward = value.includes('/');
  if (back && forward) return 'mixed';
  if (back) return 'backslash';
  if (forward) return 'forward';
  return 'none';
}

export const toForward = (p) => p.replace(/\\/g, '/');
export const toBackslash = (p) => p.replace(/\//g, '\\');

export function createContext(probeName) {
  const workDir = path.join(POC_DIR, '.tmp', probeName);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const claims = [];
  return {
    probeName,
    isWindows,
    workDir,
    REPO_ROOT,
    POC_DIR,
    separatorStyle,
    toForward,
    toBackslash,
    requireFrom,
    importFrom,
    packageVersion,
    /**
     * Records one checked claim. `expected` is the value predicted for the current platform;
     * `pass` is computed by `check(observed)` when given, otherwise by strict equality.
     */
    claim({ id, claim, kind, expected, observed, check, notes }) {
      let pass;
      let error;
      try {
        pass = check
          ? Boolean(check(observed))
          : JSON.stringify(observed) === JSON.stringify(expected);
      } catch (e) {
        pass = false;
        error = String(e?.stack ?? e);
      }
      claims.push({ id, claim, kind, expected, observed, pass, notes, error });
      return pass;
    },
    /** Records a claim whose probe step threw. */
    claimError({ id, claim, kind, expected, error }) {
      claims.push({
        id,
        claim,
        kind,
        expected,
        observed: null,
        pass: false,
        error: String(error?.stack ?? error),
      });
    },
    claims,
  };
}
