import type { ManifestClassLikeDeclaration, ManifestPackage } from './types.ts';
import { isRecord, normalizeModulePath } from '../utils.ts';

export type IndexedDeclaration = {
  declaration: ManifestClassLikeDeclaration;
  modulePath: string;
};

export type DeclarationIndex = ReadonlyMap<string, IndexedDeclaration>;

export function indexDeclarations(manifest: ManifestPackage): DeclarationIndex {
  const index = new Map<string, IndexedDeclaration>();

  for (const module of manifest.modules) {
    if (
      !isRecord(module) ||
      !Array.isArray(module.declarations) ||
      typeof module.path !== 'string'
    ) {
      continue;
    }

    for (const declaration of module.declarations) {
      if (!isManifestClassLike(declaration)) {
        continue;
      }
      const key = declarationKey(module.path, declaration.name);
      if (!index.has(key)) {
        index.set(key, { declaration, modulePath: module.path });
      }
    }
  }

  return index;
}

export function declarationKey(modulePath: string, name: string): string {
  return `${normalizeModulePath(modulePath)}#${name}`;
}

function isManifestClassLike(candidate: unknown): candidate is ManifestClassLikeDeclaration {
  return (
    isRecord(candidate) &&
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    typeof candidate.name === 'string'
  );
}
