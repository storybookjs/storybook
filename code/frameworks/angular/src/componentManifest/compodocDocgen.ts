import fs from 'node:fs';
import path from 'pathe';

import type {
  Class,
  CompodocJson,
  Component,
  Directive,
  Injectable,
  Pipe,
} from '../client/compodoc-types';

const cachedCompodocJsonByRoot = new Map<string, CompodocJson>();

function isCompodocJson(value: unknown): value is CompodocJson {
  return (
    !!value &&
    typeof value === 'object' &&
    ['components', 'directives', 'pipes', 'injectables', 'classes'].every((key) =>
      Array.isArray((value as Record<string, unknown>)[key])
    )
  );
}

/**
 * Load the Compodoc documentation.json from disk (server-side).
 *
 * Unlike the runtime flow which uses `setCompodocJson()` on the client, the manifest generator runs
 * at build-time and reads the file directly.
 *
 * The builder (start-storybook / build-storybook) executes Compodoc **before** the Storybook build,
 * so `documentation.json` is available when the manifest is generated.
 *
 * By default, `runCompodoc()` writes to `{workspaceRoot}/documentation.json`.
 */
export function loadCompodocJson(workspaceRoot: string): CompodocJson | null {
  const cached = cachedCompodocJsonByRoot.get(workspaceRoot);
  if (cached) {
    return cached;
  }

  const docPath = path.join(workspaceRoot, 'documentation.json');
  if (!fs.existsSync(docPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(docPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isCompodocJson(parsed)) {
      return null;
    }
    cachedCompodocJsonByRoot.set(workspaceRoot, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Invalidate the in-memory Compodoc JSON cache (e.g. between rebuilds). */
export function invalidateCompodocCache(): void {
  cachedCompodocJsonByRoot.clear();
}

/**
 * Find a component/directive/pipe/injectable/class in the Compodoc JSON by name.
 *
 * This mirrors the logic of `findComponentByName` in `client/compodoc.ts` but operates on a JSON
 * object passed as argument (server-side).
 */
export function findComponentInCompodoc(
  name: string,
  compodocJson: CompodocJson
): Component | Directive | Pipe | Injectable | Class | undefined {
  return (
    compodocJson.components.find((c) => c.name === name) ||
    compodocJson.directives.find((c) => c.name === name) ||
    compodocJson.pipes.find((c) => c.name === name) ||
    compodocJson.injectables.find((c) => c.name === name) ||
    compodocJson.classes.find((c) => c.name === name)
  );
}

/**
 * Extract the raw description from Compodoc component data. Prefers `rawdescription` (plain text)
 * over `description` (may contain HTML).
 */
export function extractDescription(
  componentData: Component | Directive | Pipe | Injectable | Class | undefined
): string | undefined {
  if (!componentData) {
    return undefined;
  }
  return componentData.rawdescription || componentData.description;
}

/**
 * Extract the source file path from a Compodoc component entry. Compodoc stores this in the `file`
 * field on components/directives.
 */
export function getComponentFilePath(componentData: Component | Directive): string | undefined {
  return (componentData as any).file;
}
