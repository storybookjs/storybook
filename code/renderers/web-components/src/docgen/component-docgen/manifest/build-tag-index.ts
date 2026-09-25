import type { ManifestAnyDeclaration, ManifestDeclaration, ManifestPackage } from './types.ts';

export type TagIndex = ReadonlyMap<string, ManifestDeclaration>;

export function buildTagIndex(manifest: ManifestPackage): TagIndex {
  const tags = new Map<string, ManifestDeclaration>();

  for (const module of manifest.modules) {
    for (const declaration of module.declarations ?? []) {
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
    for (const definition of module.exports ?? []) {
      if (definition.kind !== 'custom-element-definition' || tags.has(definition.name)) {
        continue;
      }

      const declaration = findDeclarationByName(
        manifest,
        definition.declaration.name,
        definition.declaration.module ?? module.path
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
