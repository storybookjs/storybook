/**
 * Version pinning, for any engine that reaches its docgen package by specifier.
 *
 * A pinned engine measures a second, explicitly-versioned copy of that package, installed under an
 * alias in this package's `package.json` (`"vue-component-meta-next": "npm:vue-component-meta@3.3.8"`).
 * An engine declares which install it measures; `--pin` carries that to a child harness.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

const require = createRequire(import.meta.url);

/** Add to a harness's `parseArgs` table to accept `--pin`. */
export const PIN_OPTION = { pin: { type: 'string' } } as const;

export interface ResolvedPin {
  /** Install directory, for a package whose CLI is spawned rather than imported. */
  dir: string;
  /** The package's own name, which an alias does not change: how a pin is checked. */
  name: string;
  version: string;
  bin?: Record<string, string>;
}

function readManifest(file: string): ResolvedPin | undefined {
  try {
    const { name, version, bin } = JSON.parse(fs.readFileSync(file, 'utf8'));
    // An unnamed manifest is a loader hint like dist/package.json, not the package's own.
    return name ? { dir: path.dirname(file), name, version, bin } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A package whose `exports` map does not list `./package.json` cannot be asked for it directly -
 * vue-docgen-api is one - so fall back to its entry point and take the manifest above it.
 */
function resolveInstall(specifier: string): string | undefined {
  for (const request of [`${specifier}/package.json`, specifier]) {
    try {
      return require.resolve(request);
    } catch {
      continue;
    }
  }
  return undefined;
}

/** The install a pin names, or undefined when it did not resolve - a partial install. */
export function resolvePin(specifier: string): ResolvedPin | undefined {
  const entry = resolveInstall(specifier);
  if (!entry) {
    return undefined;
  }
  for (let dir = path.dirname(entry); ; dir = path.dirname(dir)) {
    const manifest = readManifest(path.join(dir, 'package.json'));
    if (manifest) {
      return manifest;
    }
    if (path.dirname(dir) === dir) {
      return undefined;
    }
  }
}

/**
 * Loads the pinned copy, having checked it really is `canonical` under another name - an alias keeps
 * the aliased package's own name, so a pin that resolves elsewhere is a typo about to be measured
 * under this engine's name.
 *
 * Only the pinned copy is imported. Loading both would leave the unmeasured one's module graph on
 * the heap of every run, shifting a memory number that has nothing to do with the comparison.
 */
export async function importPinned<T>(specifier: string, canonical: string): Promise<T> {
  const resolved = resolvePin(specifier);
  if (resolved?.name !== canonical) {
    throw new Error(
      `--pin ${specifier} resolves to ${resolved ? `"${resolved.name}"` : 'nothing'}, ` +
        `not "${canonical}": a pin must name an install of the package this harness measures`
    );
  }
  return import(specifier) as Promise<T>;
}
