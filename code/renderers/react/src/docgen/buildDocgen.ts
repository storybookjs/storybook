import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenResult,
  DocgenSubcomponent,
  StrictArgTypes,
} from 'storybook/internal/types';

import { extractEach, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import path from 'pathe';

import { buildComponentDocgenFromResolved } from '../componentManifest/buildReactComponentDocgen.ts';
import {
  type ComponentMetaManager,
  isExtractable,
} from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import {
  type ResolvedStoryFile,
  resolveStoryFileComponents,
} from '../componentManifest/resolveComponents.ts';
import { extractArgTypes } from '../extractArgTypes.ts';

export interface BuildDocgenContext {
  componentMetaManager: ComponentMetaManager;
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
  /** The files of the batch this extraction is part of, by the project that extracts them. */
  batchFiles?: ReturnType<ComponentMetaManager['groupFilesByProject']>;
}

type ReactDocgenPayload = DocgenPayload & {
  reactComponentMeta?: ComponentDoc;
  subcomponents?: Record<string, DocgenSubcomponent & { reactComponentMeta?: ComponentDoc }>;
};

const REACT_ATTRIBUTE_INTERFACES = new Set(['Attributes', 'RefAttributes', 'ClassAttributes']);

/** `key` and `ref` that React's own types add to every element, not props the component reads. */
function isReactAttribute(prop: ComponentDoc['props'][string]) {
  return (
    !!prop.parent &&
    REACT_ATTRIBUTE_INTERFACES.has(prop.parent.name) &&
    /(^|[\\/])node_modules[\\/]/.test(prop.parent.fileName)
  );
}

/** Converts one RCM `ComponentDoc` into the `StrictArgTypes` shape consumed by args tables. */
export function extractArgTypesFromComponentMeta(
  componentMeta: ComponentDoc | undefined
): StrictArgTypes | undefined {
  if (!componentMeta) {
    return undefined;
  }
  // RCM defaults are source text, so a string default already carries its quotes. Without
  // `computed`, the shared conversion mistakes them for react-docgen-typescript output and quotes
  // any unquoted value (such as an unresolved identifier) a second time.
  const props = Object.fromEntries(
    Object.entries(componentMeta.props)
      .filter(([, prop]) => !isReactAttribute(prop))
      .map(([name, prop]) => [
        name,
        prop.defaultValue
          ? { ...prop, defaultValue: { ...prop.defaultValue, computed: false } }
          : prop,
      ])
  );
  return extractArgTypes({ __docgenInfo: { ...componentMeta, props } }) ?? undefined;
}

/**
 * Adds renderer-converted argTypes to the manifest-shaped React docgen payload.
 *
 * The service keeps the raw `reactComponentMeta` data for non-UI consumers, but UI consumers should
 * read `argTypes` so they do not need to know about React-specific docgen engine output.
 */
function addArgTypesFromComponentMeta(payload: ReactDocgenPayload): DocgenPayload {
  const argTypes = extractArgTypesFromComponentMeta(payload.reactComponentMeta);
  const subcomponents = payload.subcomponents
    ? Object.fromEntries(
        Object.entries(payload.subcomponents).map(([name, subcomponent]) => [
          name,
          {
            ...subcomponent,
            argTypes: extractArgTypesFromComponentMeta(subcomponent.reactComponentMeta),
          },
        ])
      )
    : undefined;

  return {
    ...payload,
    ...(argTypes ? { argTypes } : {}),
    ...(subcomponents ? { subcomponents } : {}),
  };
}

/** The refs extraction needs for one story file: its component and its resolvable subcomponents. */
export function toStoryRefs(
  storyPath: string,
  { component, subcomponents }: Pick<ResolvedStoryFile, 'component' | 'subcomponents'>
): StoryRef[] {
  return [component, ...subcomponents.map((sub) => sub.component)]
    .filter((ref): ref is ComponentRef => ref !== undefined)
    .map((ref) => ({ storyPath, component: ref }));
}

// `undefined` when the entry has no story file, or the file cannot be read or parsed.
async function resolveStory(
  { entry }: DocgenProviderInput,
  context: Pick<BuildDocgenContext, 'typescriptOptions' | 'resolvePath'>
) {
  const storyFilePath = getStoryImportPathFromEntry(entry);
  if (!storyFilePath) {
    return undefined;
  }
  const storyPath = resolveStoryPath(storyFilePath, context);
  try {
    const resolved = await resolveStoryFileComponents({
      storyPath,
      title: entry.title,
      typescriptOptions: context.typescriptOptions,
      docgenEngine: 'react-component-meta',
    });
    return { storyFilePath, storyPath, resolved };
  } catch {
    return undefined;
  }
}

const resolveStoryPath = (
  storyFilePath: string,
  { resolvePath }: Pick<BuildDocgenContext, 'resolvePath'>
) => (resolvePath ? resolvePath(storyFilePath) : path.join(process.cwd(), storyFilePath));

// Each project gets the story and component files of every input before its first extraction, so
// it rebuilds its program once for the batch and not once per component. When the programs do not
// fit the heap, the manager recycles its projects, and the rest of the batch adds files as it
// reaches them.
export async function buildDocgenPayloads(
  inputs: DocgenProviderInput[],
  context: BuildDocgenContext
): Promise<DocgenResult[]> {
  // One input has no batch files to share, so it skips the second parse.
  if (inputs.length === 1) {
    return extractEach(inputs, (input) => buildDocgenPayload(input, context));
  }
  // Keep only the refs: parsed story files held for the whole batch take heap the programs need.
  const refs = (
    await Promise.all(
      inputs.map(async (input) => {
        const story = await resolveStory(input, context);
        return story ? toStoryRefs(story.storyPath, story.resolved) : [];
      })
    )
  ).flat();
  let batchFiles: BuildDocgenContext['batchFiles'];
  // The batch files are an optimization: without them, each extraction adds its own files. The
  // native TypeScript backend can throw when a file joins the inferred project.
  try {
    batchFiles = context.componentMetaManager.groupFilesByProject(
      refs.filter(isExtractable).map(({ storyPath, component }) => ({
        projectFile: storyPath,
        files: [storyPath, component.path],
      }))
    );
  } catch (err) {
    logger.debug(`[reactComponentMeta] Grouping the batch files failed: ${err}`);
  }
  return extractEach(inputs, (input) => buildDocgenPayload(input, { ...context, batchFiles }));
}

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Uses {@link resolveStoryFileComponents} and {@link buildComponentDocgenFromResolved} for
 * shared field shaping, runs RCM `batchExtract`, then returns component docgen without story
 * snippets (those live in `core/story-docs`).
 *
 * Returns `undefined` when the story file cannot be read or parsed — the docgen-service provider
 * chain treats undefined as "no docgen here, fall through to the next provider". Resolution errors
 * surfaced on the resolved docgen are returned as a payload (not undefined).
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload | undefined> {
  const story = await resolveStory(input, context);
  if (!story) {
    return undefined;
  }
  const { storyFilePath, storyPath, resolved } = story;
  const { csf, componentName, component, subcomponents, storyFile } = resolved;

  const storyRefs = toStoryRefs(storyPath, resolved);
  if (storyRefs.length > 0) {
    context.componentMetaManager.batchExtract(storyRefs, context.batchFiles);
  }

  const componentDocgen = buildComponentDocgenFromResolved({
    entry: input.entry,
    storyPath,
    storyFilePath,
    storyFile,
    csf,
    componentName,
    component,
    subcomponents,
    docgenEngine: 'react-component-meta',
  });

  return addArgTypesFromComponentMeta(componentDocgen);
}
