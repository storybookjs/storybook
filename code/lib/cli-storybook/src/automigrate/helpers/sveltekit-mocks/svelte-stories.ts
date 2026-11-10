import {
  type ESTree as E,
  objectList,
  objectProperty,
  removeFromList,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { type StoryAttribute, type SvelteCsfStory, loadSvelteCsf } from '../svelte-csf-file.ts';
import {
  type PreviewMocks,
  findUnmigrated,
  migratedKeys,
  objectLevel,
  readContext,
} from './csf-files.ts';
import {
  arrowFunction,
  findObjectSite,
  hasAutodocs,
  prependToBeforeEach,
  tagsOf,
} from './edit-levels.ts';
import { type EditOptions, type Level, failWith, migrateLevels } from './migrate-levels.ts';
import {
  KEY,
  type MergedKeys,
  type Problem,
  mergeKeys,
  noMergedKeys,
  readMocks,
} from './mock-statements.ts';

interface StorySite {
  story: SvelteCsfStory;
  parameters: StoryAttribute;
  object: E.ObjectExpression;
  sveltekit: E.ObjectProperty;
  beforeEach?: StoryAttribute;
}

// Migrate the `sveltekit_experimental` parameters of a Svelte CSF file, or `null` for none.
export const migrateSvelteStories = async (
  code: string,
  id: string,
  preview: PreviewMocks & { mdxDocsPage?: boolean }
) => {
  const file = await loadSvelteCsf(code, id);
  const { module, instance, meta } = file;
  const metaSite = meta?.object && findObjectSite(meta.object);
  const problems: Problem[] = [];
  for (const region of [module, instance]) {
    if (region) {
      const sites = new Set(region === module && metaSite ? [metaSite.sveltekit] : []);
      problems.push(...findUnmigrated(region.editor.program, sites, region.toFile));
    }
  }
  problems.push(
    ...file.unparsed(new RegExp(`\\b${KEY}\\b`, 'g')).map((index) => ({
      index,
      message: `\`${KEY}\` is outside the \`<script module>\` and the \`<Story>\` attributes, so the fix can't tell which stories use it.`,
    }))
  );
  // Without a meta, such as in the legacy syntax, the file has no stories to migrate
  if (!module || !meta) {
    return problems.length > 0 ? failWith(code, problems) : null;
  }

  const levels: Level[] = [];
  let outer = preview.merged;
  if (metaSite) {
    const context = readContext(module.editor, module.editor, outer);
    const mocks = readMocks(module.editor, metaSite.sveltekit.value, context);
    levels.push(objectLevel('meta', module.editor, metaSite, mocks, module.toFile));
    outer = mergeKeys(outer, mocks.merged);
  }
  outer = mergeKeys(
    outer,
    migratedKeys(module.editor, meta.object && objectProperty(meta.object, 'beforeEach')?.value)
  );

  const sites: StorySite[] = [];
  // A story's own `autodocs` tag gives the file a docs page too
  let storyAutodocs = false;
  for (const story of file.stories) {
    const { attributes } = story;
    const tags = attributes.get('tags');
    storyAutodocs ||= !!(tags && tagsOf(tags.node)?.includes('autodocs'));
    const parameters = attributes.get('parameters');
    const object = parameters && unwrapExpression(parameters.node);
    const sveltekit = object?.type === 'ObjectExpression' ? objectProperty(object, KEY) : undefined;
    for (const attribute of attributes.values()) {
      const sites = new Set(attribute === parameters && sveltekit ? [sveltekit] : []);
      problems.push(...findUnmigrated(attribute.editor.program, sites, attribute.toFile));
    }
    if (!parameters || !sveltekit) {
      continue;
    }
    if (story.spreads) {
      problems.push({
        index: story.start,
        message:
          'The `<Story>` spreads attributes, which can set `beforeEach` and `parameters` too.',
      });
      continue;
    }
    sites.push({
      story,
      parameters,
      object: object as E.ObjectExpression,
      sveltekit,
      beforeEach: attributes.get('beforeEach'),
    });
  }

  // `<Story extend="Base">` merges its parameters with the ones of the story named `Base`
  const readStory = (site: StorySite, storyOuter: MergedKeys) => {
    const context = readContext(
      site.parameters.editor,
      module.editor,
      storyOuter,
      instance?.editor
    );
    return readMocks(site.parameters.editor, site.sveltekit.value, context);
  };
  const ownKeys = new Map(
    sites.flatMap((site) =>
      site.story.name ? [[site.story.name, readStory(site, outer).merged]] : []
    )
  );
  for (const site of sites) {
    const storyOuter = site.story.ancestors.reduce(
      (keys, ancestor) => mergeKeys(keys, ownKeys.get(ancestor) ?? noMergedKeys()),
      outer
    );
    levels.push({
      kind: 'story',
      editor: site.parameters.editor,
      toFile: site.parameters.toFile,
      sveltekit: site.sveltekit,
      mocks: readStory(site, storyOuter),
      edit: (statements, options) => editStory(site, statements, options),
    });
  }

  const instanceNames = instance ? [...instance.editor.scopes.program.bindings.keys()] : [];
  return migrateLevels({
    code,
    module: module.editor,
    levels,
    problems,
    implemented: preview.merged.functions,
    docs: meta.object && {
      meta: meta.object,
      toFile: module.toFile,
      hasDocsPage:
        !!preview.mdxDocsPage || storyAutodocs || hasAutodocs(meta.object, preview.autodocs),
    },
    shadowed: instanceNames,
    // The markup has the stories' statements, and no longer the parameters that the fix removed
    outside: () => file.markup(),
    toString: () => file.toString(),
  });
};

const editStory = (
  { parameters, object, sveltekit, beforeEach }: StorySite,
  statements: string[],
  style: EditOptions
) => {
  const added = arrowFunction(statements, style.step);
  if (statements.length > 0 && beforeEach) {
    prependToBeforeEach(beforeEach.editor, beforeEach.node, statements, style);
  }
  if (object.properties.length > 1) {
    removeFromList(parameters.editor, objectList(parameters.editor, object), [sveltekit]);
    if (statements.length > 0 && !beforeEach) {
      parameters.insertAfter('beforeEach', added);
    }
  } else if (statements.length > 0 && !beforeEach) {
    parameters.replaceWith('beforeEach', added);
  } else {
    parameters.remove();
  }
};
