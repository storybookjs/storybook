import type { ManifestDeclaration, ManifestPackage } from './types.ts';
import {
  createDeclarationLookup,
  createInheritanceResolver,
  isManifestClassLike,
} from './resolve-inheritance.ts';
import { isRecord } from '../utils.ts';

export type TagIndex = ReadonlyMap<string, ManifestDeclaration>;

export function buildTagIndex(manifest: ManifestPackage): TagIndex {
  const tags = new Map<string, ManifestDeclaration>();
  const lookup = createDeclarationLookup(manifest);
  const resolveInheritance = createInheritanceResolver(manifest);

  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.declarations)) {
      continue;
    }

    const modulePath = typeof module.path === 'string' ? module.path : undefined;

    for (const declaration of module.declarations) {
      if (
        isManifestDeclaration(declaration) &&
        declaration.tagName &&
        !tags.has(declaration.tagName)
      ) {
        tags.set(declaration.tagName, resolveInheritance(declaration, modulePath));
      }
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
            : undefined;
      if (modulePath === undefined) {
        continue;
      }

      const resolvedDeclaration = lookup(modulePath, definition.declaration.name);
      if (resolvedDeclaration && isManifestDeclaration(resolvedDeclaration.declaration)) {
        tags.set(
          definition.name,
          resolveInheritance(resolvedDeclaration.declaration, resolvedDeclaration.modulePath)
        );
      }
    }
  }

  return tags;
}

function isManifestDeclaration(candidate: unknown): candidate is ManifestDeclaration {
  return (
    isManifestClassLike(candidate) &&
    candidate.kind === 'class' &&
    'customElement' in candidate &&
    candidate.customElement === true
  );
}
