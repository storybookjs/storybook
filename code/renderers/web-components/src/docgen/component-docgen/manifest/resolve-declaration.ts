import { isFailedManifest, type ManifestLoadResult } from './load-manifest.ts';
import type { ManifestAnyDeclaration, ManifestDeclaration, ManifestPackage } from './types.ts';

export interface ResolvedDeclaration {
  manifestPath: string;
  declaration: ManifestDeclaration;
}

function findDeclarationByName(
  manifest: ManifestPackage,
  name: string,
  modulePath: string | undefined
): ManifestDeclaration | undefined {
  for (const module of manifest.modules) {
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

function isManifestDeclaration(
  candidate: ManifestAnyDeclaration
): candidate is ManifestDeclaration {
  return (
    (candidate.kind === 'class' || candidate.kind === 'mixin') &&
    'customElement' in candidate &&
    candidate.customElement === true
  );
}

export function resolveDeclarationForTag(
  manifests: ManifestLoadResult[],
  tag: string
): ResolvedDeclaration | undefined {
  for (const loaded of manifests) {
    if (isFailedManifest(loaded)) {
      continue;
    }

    for (const module of loaded.manifest.modules) {
      const declaration = module.declarations?.find(
        (candidate): candidate is ManifestDeclaration =>
          isManifestDeclaration(candidate) && candidate.tagName === tag
      );
      if (declaration) {
        return { manifestPath: loaded.path, declaration };
      }
    }

    for (const module of loaded.manifest.modules) {
      const definition = module.exports?.find(
        (candidate) => candidate.kind === 'custom-element-definition' && candidate.name === tag
      );
      const declarationName = definition?.declaration?.name;
      if (!declarationName) {
        continue;
      }
      const declaration = findDeclarationByName(
        loaded.manifest,
        declarationName,
        definition.declaration?.module ?? module.path
      );
      if (declaration) {
        return { manifestPath: loaded.path, declaration };
      }
    }
  }
  return undefined;
}
