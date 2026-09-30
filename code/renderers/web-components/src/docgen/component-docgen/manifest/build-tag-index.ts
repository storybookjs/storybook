import type { ManifestDeclaration, ManifestPackage } from './types.ts';
import {
  indexDeclarations,
  isManifestClassLike,
  type IndexedDeclaration,
} from './declaration-index.ts';
import { createInheritanceResolver } from './resolve-inheritance.ts';
import { isRecord } from '../utils.ts';

export type TagIndex = ReadonlyMap<string, ManifestDeclaration>;

export function buildTagIndex(manifest: ManifestPackage): TagIndex {
  const tags = new Map<string, ManifestDeclaration>();
  const index = indexDeclarations(manifest);
  const flatten = createInheritanceResolver(index);
  // Flattening only adds and merges list items, so a custom element declaration stays one.
  const flattenTag = (entry: IndexedDeclaration): ManifestDeclaration =>
    flatten(entry) as ManifestDeclaration;

  for (const entry of index.entries) {
    const { declaration } = entry;
    if (
      isManifestDeclaration(declaration) &&
      declaration.tagName &&
      !tags.has(declaration.tagName)
    ) {
      tags.set(declaration.tagName, flattenTag(entry));
    }
  }

  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.exports)) {
      continue;
    }

    for (const definition of module.exports) {
      if (
        !isRecord(definition) ||
        definition.kind !== 'custom-element-definition' ||
        typeof definition.name !== 'string' ||
        tags.has(definition.name) ||
        !isRecord(definition.declaration) ||
        typeof definition.declaration.name !== 'string'
      ) {
        continue;
      }

      const modulePath =
        typeof definition.declaration.module === 'string'
          ? definition.declaration.module
          : typeof module.path === 'string'
            ? module.path
            : '';
      const entry = index.get(modulePath, definition.declaration.name);
      if (entry && isManifestDeclaration(entry.declaration)) {
        tags.set(definition.name, flattenTag(entry));
      }
    }
  }

  return tags;
}

function isManifestDeclaration(candidate: unknown): candidate is ManifestDeclaration {
  return (
    isManifestClassLike(candidate) &&
    'customElement' in candidate &&
    candidate.customElement === true
  );
}
