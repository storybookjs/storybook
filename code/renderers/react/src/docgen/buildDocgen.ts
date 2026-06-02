import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
} from 'storybook/internal/types';

import path from 'pathe';

import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import {
  extractStorySnippets,
  resolveStoryFileComponents,
} from '../componentManifest/resolveComponents.ts';

/**
 * Prop descriptor emitted by the React docgen provider, mirroring RCM's `PropItem`. The core
 * docgen contract types props as `unknown` (the shape is integration-specific); this is the
 * concrete shape the React renderer contributes.
 */
interface ReactDocgenProp {
  name: string;
  required: boolean;
  type: ComponentDoc['props'][string]['type'];
  description: string;
  defaultValue: ComponentDoc['props'][string]['defaultValue'];
}

function mapProps(doc: ComponentDoc | undefined): ReactDocgenProp[] {
  if (!doc) {
    return [];
  }
  return Object.values(doc.props).map((prop) => ({
    name: prop.name,
    required: prop.required,
    type: prop.type,
    description: prop.description,
    defaultValue: prop.defaultValue,
  }));
}

function buildSubcomponentEntry(name: string, component: ComponentRef): DocgenSubcomponent {
  const doc = component.reactComponentMeta;
  const description = doc?.description?.trim() || undefined;
  const jsDocTags: DocgenJsDocTags | undefined = component.componentJsDocTags ?? doc?.jsDocTags;
  return {
    name,
    description,
    jsDocTags,
    props: mapProps(doc),
  };
}

export interface BuildDocgenContext {
  manager: ComponentMetaManager;
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Resolution (read CSF, scan for component refs, match the primary component + declared
 * subcomponents) is shared with the manifest generator via {@link resolveStoryFileComponents};
 * this function adds the RCM extraction (`batchExtract` for the resolved refs) and maps the result
 * into the docgen-service schema.
 *
 * Returns `undefined` when the file cannot be read, can't be parsed as CSF, or doesn't resolve to
 * any extractable component — the docgen-service provider chain treats undefined as "no docgen
 * here, fall through to the next provider".
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload | undefined> {
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => path.join(process.cwd(), importPath));
  const storyPath = resolvePath(input.importPath);

  let resolved;
  try {
    resolved = await resolveStoryFileComponents({
      storyPath,
      title: input.importPath,
      typescriptOptions: context.typescriptOptions,
      docgenEngine: 'react-component-meta',
    });
  } catch {
    return undefined;
  }

  const { csf, componentName: metaComponentName, component, subcomponents } = resolved;
  if (!component) {
    return undefined;
  }

  const usableSubcomponents = subcomponents.filter(
    (sub): sub is { name: string; component: ComponentRef } => sub.component !== undefined
  );

  // Extract docgen for the primary component and every resolved subcomponent in one batch, so the
  // TS program and file-snapshot cache are shared across them.
  const storyRefs: StoryRef[] = [
    { storyPath, component },
    ...usableSubcomponents.map((sub) => ({ storyPath, component: sub.component })),
  ];
  context.manager.batchExtract(storyRefs);

  const doc = component.reactComponentMeta;
  const componentId = component.componentName ?? metaComponentName ?? input.importPath;
  const name = component.componentName ?? metaComponentName ?? componentId;
  const description = (doc?.description ?? '').trim();
  const jsDocTags: DocgenJsDocTags | undefined = component.componentJsDocTags ?? doc?.jsDocTags;
  const props = mapProps(doc);
  const stories = extractStorySnippets(csf, component.componentName);
  const subcomponentEntries =
    usableSubcomponents.length > 0
      ? Object.fromEntries(
          usableSubcomponents.map((sub) => [
            sub.name,
            buildSubcomponentEntry(sub.name, sub.component),
          ])
        )
      : undefined;

  return {
    componentId,
    name,
    description,
    summary: jsDocTags?.summary?.[0],
    jsDocTags,
    props,
    ...(subcomponentEntries ? { subcomponents: subcomponentEntries } : {}),
    ...(stories.length > 0 ? { stories } : {}),
  };
}
