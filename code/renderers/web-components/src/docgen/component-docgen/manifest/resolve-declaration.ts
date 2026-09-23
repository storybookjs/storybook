import type { TagItemGroups } from '../../../docs/map-arg-types.ts';
import type { ManifestLoadResult } from './load-manifest.ts';

export interface CustomElementsDeclaration extends TagItemGroups {
  [key: string]: unknown;
}

interface CustomElementsModule {
  path?: string;
  declarations?: CustomElementsDeclaration[];
  exports?: CustomElementDefinitionExport[];
}

interface CustomElementDefinitionExport {
  kind?: string;
  name?: string;
  declaration?: {
    name?: string;
    module?: string;
  };
}

export interface CustomElementsManifest {
  modules: CustomElementsModule[];
  [key: string]: unknown;
}

export interface ResolvedDeclaration {
  manifestPath: string;
  declaration: CustomElementsDeclaration;
}

function findDeclarationByName(
  manifest: CustomElementsManifest,
  name: string,
  modulePath: string | undefined
): CustomElementsDeclaration | undefined {
  for (const module of manifest.modules) {
    if (modulePath !== undefined && module.path !== modulePath) {
      continue;
    }
    const declaration = module.declarations?.find((candidate) => candidate.name === name);
    if (declaration) {
      return declaration;
    }
  }
  return undefined;
}

export function resolveDeclarationForTag(
  manifests: ManifestLoadResult[],
  tag: string
): ResolvedDeclaration | undefined {
  for (const loaded of manifests) {
    if ('error' in loaded) {
      continue;
    }

    for (const module of loaded.manifest.modules) {
      const declaration = module.declarations?.find((candidate) => candidate.tagName === tag);
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
