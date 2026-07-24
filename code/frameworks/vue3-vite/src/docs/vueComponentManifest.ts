import { readFileSync } from 'node:fs';
import path from 'node:path';

import { recast } from 'storybook/internal/babel';
import {
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type {
  ComponentManifest,
  IndexEntry,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { type ComponentMeta, TypeMeta } from 'vue-component-meta';

import {
  type VueComponentMetaChecker,
  applyTempFixForEventDescriptions,
  createVueComponentMetaChecker,
  filterExposed,
  getFilenameWithoutExtension,
  stripNestedSchemas,
} from '../plugins/vue-component-meta-checker.ts';
import { renderVueapiMd } from './vueapiMd.ts';

export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const { manifestEntries } = options;
  const entriesByUniqueComponent = [
    ...selectComponentEntriesByComponentId(manifestEntries).values(),
  ];

  const startTime = performance.now();

  // Build the Volar checker ONCE for the whole manifest generation. A failure to construct it must
  // not fail the build — every row is still emitted, just without an `apiMd` fragment.
  let checker: VueComponentMetaChecker | undefined;
  try {
    checker = await createVueComponentMetaChecker('tsconfig.json', process.cwd());
  } catch (error) {
    logger.warn(
      `Vue component-meta checker could not be created; emitting manifest rows without apiMd: ${String(error)}`
    );
  }

  const rows = await Promise.all(
    entriesByUniqueComponent.map((entry) => buildVueComponentManifest(entry, checker))
  );
  const components = Object.fromEntries(
    rows.filter((row): row is ComponentManifest => row !== undefined).map((row) => [row.id, row])
  );

  const durationMs = Math.round(performance.now() - startTime);

  return {
    ...existingManifests,
    components: {
      v: 0,
      components,
      meta: { docgen: 'vue-component-meta', durationMs },
    },
  };
};

/** One story's snippet + metadata, resolved from the CSF. */
interface VueStory {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
}

/**
 * Resolves the component's raw CSF import path (relative only) to an absolute file path. Bare/aliased
 * specifiers are not resolvable without a bundler and are out of scope for this phase.
 */
function resolveComponentPath(
  rawComponentPath: string | undefined,
  storyPath: string
): string | undefined {
  if (!rawComponentPath || !rawComponentPath.startsWith('.')) {
    return undefined;
  }
  return path.resolve(path.dirname(storyPath), rawComponentPath);
}

/** Whether a component meta documents nothing renderable. */
function isEmptyMeta(meta: ComponentMeta): boolean {
  return !meta.props.length && !meta.events.length && !meta.slots.length && !meta.exposed.length;
}

/**
 * Builds one v0 manifest row. The row is always emitted with neutral fields (id/name/path/stories);
 * `apiMd` is populated only when component-meta extraction succeeds. Per-component failures are
 * logged and skip the fragment, never failing the build.
 */
async function buildVueComponentManifest(
  entry: IndexEntry,
  checker: VueComponentMetaChecker | undefined
): Promise<ComponentManifest | undefined> {
  const storyImportPath = getStoryImportPathFromEntry(entry);
  if (!storyImportPath) {
    return undefined;
  }
  const storyPath = path.join(process.cwd(), storyImportPath);

  let componentName: string | undefined;
  let componentPath: string | undefined;
  let stories: VueStory[] = [];
  try {
    const storySource = readFileSync(storyPath, 'utf-8');
    const csf = loadCsf(storySource, { makeTitle: () => entry.title }).parse();
    componentName = csf._meta?.component;
    componentPath = resolveComponentPath(csf._rawComponentPath, storyPath);
    stories = extractStorySnippets(csf);
  } catch (error) {
    logger.debug(`Vue manifest could not parse ${storyPath}: ${String(error)}`);
    return undefined;
  }

  if (!componentPath) {
    return undefined;
  }

  const baseRow: ComponentManifest = {
    id: getComponentIdFromEntry(entry),
    name: componentName ?? entry.title.split('/').at(-1)!,
    path: path.relative(process.cwd(), componentPath),
    renderer: 'vue3',
    stories,
    jsDocTags: {},
  };

  if (!checker) {
    return baseRow;
  }

  let selected: { meta: ComponentMeta; displayName: string } | undefined;
  try {
    selected = await extractComponentMeta(checker, componentPath, componentName);
  } catch (error) {
    logger.warn(
      `Vue component-meta failed for ${componentPath}, emitting row without apiMd: ${String(error)}`
    );
    return baseRow;
  }

  if (!selected) {
    return baseRow;
  }

  const { meta, displayName } = selected;
  // Drop nested schemas (bundle-size / OOM guard) and dedupe the exposed list exactly as the docgen
  // plugin does. The Volar meta exposes getter-only properties, so we spread into a plain object
  // (with the filtered exposed list) rather than mutating it, then render the resolved-type fragment.
  stripNestedSchemas(meta);
  const renderMeta = { ...meta, exposed: filterExposed(meta) };

  return {
    ...baseRow,
    name: componentName ?? displayName ?? baseRow.name,
    description: meta.description?.trim() || undefined,
    apiMd: renderVueapiMd(renderMeta) || undefined,
  };
}

/**
 * Runs the Volar checker over one component file and picks the meta to document. A file can export
 * several components; we prefer the one whose display name matches the CSF `component`, else the first
 * one that documents anything.
 */
async function extractComponentMeta(
  checker: VueComponentMetaChecker,
  componentPath: string,
  componentName: string | undefined
): Promise<{ meta: ComponentMeta; displayName: string } | undefined> {
  const exportNames = checker.getExportNames(componentPath);
  if (!exportNames.length) {
    return undefined;
  }

  const metas = exportNames.map((name) => checker.getComponentMeta(componentPath, name));
  // Volar cannot extract event descriptions; this patches them in-place from vue-docgen-api, but only
  // when a component actually declares events (otherwise it is a no-op).
  await applyTempFixForEventDescriptions(componentPath, metas);

  const candidates = exportNames.map((name, index) => ({
    meta: metas[index],
    displayName: name === 'default' ? getFilenameWithoutExtension(componentPath) : name,
  }));

  const documentable = candidates.filter(
    (candidate) => candidate.meta.type !== TypeMeta.Unknown && !isEmptyMeta(candidate.meta)
  );

  const pool = documentable.length > 0 ? documentable : candidates;
  return pool.find((candidate) => candidate.displayName === componentName) ?? pool[0];
}

/** Extracts per-story snippets (printed CSF story source) + descriptions from a parsed CSF file. */
function extractStorySnippets(csf: ReturnType<ReturnType<typeof loadCsf>['parse']>): VueStory[] {
  return Object.entries(csf._stories).map(([storyExport, story]): VueStory => {
    const name = story.name ?? storyNameFromExport(storyExport);
    try {
      const statement = csf._storyStatements[storyExport];
      const snippet = statement ? recast.print(statement).code : undefined;
      const description = extractDescription(statement)?.trim();
      return { id: story.id, name, snippet, description };
    } catch {
      return { id: story.id, name };
    }
  });
}
