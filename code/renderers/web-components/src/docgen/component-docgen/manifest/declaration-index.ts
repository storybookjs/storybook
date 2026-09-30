import type { ManifestClassLikeDeclaration, ManifestPackage, ManifestReference } from './types.ts';
import { isRecord } from '../utils.ts';

export type IndexedDeclaration = {
  declaration: ManifestClassLikeDeclaration;
  modulePath: string;
  // Well-formed `mixins`, in order, then `superclass`.
  references: ManifestReference[];
};

export type DeclarationIndex = {
  entries: readonly IndexedDeclaration[];
  get: (modulePath: string, name: string) => IndexedDeclaration | undefined;
};

export function indexDeclarations(manifest: ManifestPackage): DeclarationIndex {
  const byKey = new Map<string, IndexedDeclaration>();

  for (const module of manifest.modules) {
    if (!isRecord(module) || !Array.isArray(module.declarations)) {
      continue;
    }
    // The schema requires `path`; without one the module still indexes, under an empty path.
    const modulePath = typeof module.path === 'string' ? module.path : '';

    for (const declaration of module.declarations) {
      if (!isManifestClassLike(declaration)) {
        continue;
      }
      const key = keyFor(modulePath, declaration.name);
      if (!byKey.has(key)) {
        byKey.set(key, { declaration, modulePath, references: referencesOf(declaration) });
      }
    }
  }

  return {
    entries: [...byKey.values()],
    get: (modulePath, name) => byKey.get(keyFor(modulePath, name)),
  };
}

export function isManifestClassLike(candidate: unknown): candidate is ManifestClassLikeDeclaration {
  return (
    isRecord(candidate) &&
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    typeof candidate.name === 'string'
  );
}

function referencesOf(declaration: ManifestClassLikeDeclaration): ManifestReference[] {
  const candidates: unknown[] = [
    ...(Array.isArray(declaration.mixins) ? declaration.mixins : []),
    declaration.superclass,
  ];
  return candidates.filter(isReference);
}

function isReference(candidate: unknown): candidate is ManifestReference {
  return (
    isRecord(candidate) &&
    typeof candidate.name === 'string' &&
    (candidate.module === undefined || typeof candidate.module === 'string') &&
    (candidate.package === undefined || typeof candidate.package === 'string')
  );
}

// Manifests disagree on a leading `./` or `/` in module paths.
function keyFor(modulePath: string, name: string): string {
  return `${modulePath.replace(/^\.?\//, '')}#${name}`;
}
