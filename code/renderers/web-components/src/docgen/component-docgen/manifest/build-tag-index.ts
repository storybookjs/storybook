import type { ManifestDeclaration, ManifestPackage } from './types.ts';
import { isRecord } from '../utils.ts';

export type TagIndex = ReadonlyMap<string, ManifestDeclaration>;

export function buildTagIndex(manifest: ManifestPackage): TagIndex {
  const tags = new Map<string, ManifestDeclaration>();

  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.declarations)) {
      continue;
    }

    for (const declaration of module.declarations) {
      if (
        isManifestDeclaration(declaration) &&
        declaration.tagName &&
        !tags.has(declaration.tagName)
      ) {
        tags.set(declaration.tagName, declaration);
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

      const declaration = findDeclarationByName(
        manifest,
        definition.declaration.name,
        typeof definition.declaration.module === 'string'
          ? definition.declaration.module
          : typeof module.path === 'string'
            ? module.path
            : undefined
      );
      if (declaration) {
        tags.set(definition.name, declaration);
      }
    }
  }

  return tags;
}

function findDeclarationByName(
  manifest: ManifestPackage,
  name: string,
  modulePath: string | undefined
): ManifestDeclaration | undefined {
  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.declarations)) {
      continue;
    }

    if (modulePath !== undefined && module.path !== modulePath) {
      continue;
    }
    const declaration = module.declarations?.find(
      (candidate): candidate is ManifestDeclaration =>
        isManifestDeclaration(candidate) && candidate.name === name
    );
    if (declaration) {
      return declaration;
    }
  }
  return undefined;
}

function isManifestDeclaration(candidate: unknown): candidate is ManifestDeclaration {
  return (
    isRecord(candidate) &&
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    'customElement' in candidate &&
    candidate.customElement === true
  );
}
