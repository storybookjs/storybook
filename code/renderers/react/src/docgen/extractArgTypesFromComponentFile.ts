import type { TypeScriptSpecifierForDocgen } from 'storybook/internal/common';
import type { StrictArgTypes } from 'storybook/internal/types';

import { getSharedComponentMetaManager } from '../componentManifest/componentMetaManagerSingleton.ts';
import type { ComponentRef } from '../componentManifest/getComponentImports.ts';
import { extractArgTypesFromComponentMeta } from './buildDocgen.ts';

/**
 * Infer the arg types of one exported component with react-component-meta, the engine of the docgen
 * server, so callers outside a story file (such as ghost stories) do not need `react-docgen`.
 *
 * The component file doubles as the entry that the TypeScript program is built from. Resolves to
 * `null` when `typescript` is unusable or the export is not a component.
 */
export async function extractArgTypesFromComponentFile({
  componentFilePath,
  componentExportName = 'default',
  typeScriptSpecifier,
}: {
  componentFilePath: string;
  componentExportName?: string;
  // The main config's `typescript.docgenSpecifier`, when it names the TypeScript to load.
  typeScriptSpecifier?: TypeScriptSpecifierForDocgen;
}): Promise<StrictArgTypes | null> {
  const manager = await getSharedComponentMetaManager(typeScriptSpecifier);
  if (!manager) {
    return null;
  }
  const component: ComponentRef = {
    componentName: componentExportName,
    importName: componentExportName,
    path: componentFilePath,
    isPackage: false,
  };
  manager.batchExtract([{ storyPath: componentFilePath, component }]);
  return extractArgTypesFromComponentMeta(component.reactComponentMeta) ?? null;
}
