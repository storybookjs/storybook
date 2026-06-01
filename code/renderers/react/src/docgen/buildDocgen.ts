import { recast } from 'storybook/internal/babel';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  DocgenStory,
  DocgenSubcomponent,
} from 'storybook/internal/types';

import path from 'pathe';

import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import { getCodeSnippet } from '../componentManifest/generateCodeSnippet.ts';
import { findMatchingComponent } from '../componentManifest/generator.ts';
import {
  type ComponentRef,
  type StoryRef,
  type TypescriptOptions,
  getComponents,
} from '../componentManifest/getComponentImports.ts';
import { extractJSDocInfo } from '../componentManifest/jsdocTags.ts';
import {
  extractDeclaredSubcomponents,
  findExactComponentMatch,
} from '../componentManifest/subcomponents.ts';
import { cachedReadTextFileSync } from '../componentManifest/utils.ts';

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

function buildStories(
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  componentName: string | undefined
): DocgenStory[] {
  return Object.entries(csf._stories).map(([storyExport, story]): DocgenStory => {
    const name = story.name ?? storyNameFromExport(storyExport);
    try {
      const jsdocComment = extractDescription(csf._storyStatements[storyExport]);
      const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
      const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;
      return {
        id: story.id,
        name,
        snippet: recast.print(getCodeSnippet(csf, storyExport, componentName)).code,
        description: finalDescription?.trim(),
        summary: tags.summary?.[0],
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { id: story.id, name, error: { name: err.name, message: err.message } };
    }
  });
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
 * Reads the story file, resolves the component reference (and any declared subcomponents) via
 * {@link getComponents}, batch-extracts `ComponentDoc`s through the shared {@link ComponentMetaManager}
 * (so the TS program and file-snapshot cache are reused across the primary component and its
 * subcomponents), then maps the result into the docgen-service schema.
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

  let csf: ReturnType<ReturnType<typeof loadCsf>['parse']>;
  try {
    const storyFile = cachedReadTextFileSync(storyPath);
    csf = loadCsf(storyFile, { makeTitle: () => input.importPath }).parse();
  } catch {
    return undefined;
  }

  const declaredSubcomponents = extractDeclaredSubcomponents(csf);
  const allComponents = await getComponents({
    additionalComponentNames: declaredSubcomponents.map((s) => s.componentName),
    csf,
    storyFilePath: storyPath,
    typescriptOptions: context.typescriptOptions,
    docgenEngine: 'react-component-meta',
  });

  const metaComponentName = csf._meta?.component;
  const title = csf._meta?.title ?? '';
  const component = findMatchingComponent(allComponents, metaComponentName, title);

  if (!component) {
    return undefined;
  }

  const resolvedSubcomponents = declaredSubcomponents.flatMap((declared) => {
    const ref = findExactComponentMatch(allComponents, declared.componentName);
    return ref ? [{ name: declared.name, component: ref }] : [];
  });

  const storyRefs: StoryRef[] = [
    { storyPath, component },
    ...resolvedSubcomponents.map(({ component: ref }) => ({ storyPath, component: ref })),
  ];
  context.manager.batchExtract(storyRefs);

  const doc = component.reactComponentMeta;
  const componentId = component.componentName ?? metaComponentName ?? input.importPath;
  const name = component.componentName ?? metaComponentName ?? componentId;
  const description = (doc?.description ?? '').trim();
  const jsDocTags: DocgenJsDocTags | undefined = component.componentJsDocTags ?? doc?.jsDocTags;
  const props = mapProps(doc);
  const stories = buildStories(csf, component.componentName);
  const subcomponents =
    resolvedSubcomponents.length > 0
      ? Object.fromEntries(
          resolvedSubcomponents.map(({ name: subName, component: subRef }) => [
            subName,
            buildSubcomponentEntry(subName, subRef),
          ])
        )
      : undefined;

  return {
    componentId,
    name,
    description,
    jsDocTags,
    props,
    ...(subcomponents ? { subcomponents } : {}),
    ...(stories.length > 0 ? { stories } : {}),
  };
}
