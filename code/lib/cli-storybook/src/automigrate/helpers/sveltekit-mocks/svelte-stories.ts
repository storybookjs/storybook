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
  failWith,
  findUnmigrated,
  migratedKeys,
  readContext,
  styleOf,
  takenNames,
} from './csf-files.ts';
import {
  type ObjectSite,
  addInlineFalseToMeta,
  arrowFunction,
  editObjectSite,
  findObjectSite,
  hasAutodocs,
  prependToBeforeEach,
  INLINE_PROBLEM,
  inlineOf,
  isFalse,
  SPREAD_PROBLEM,
  spreadsBeforeEach,
  tagsOf,
} from './edit-levels.ts';
import { MockImports, aliasedImports, readsName } from './mock-imports.ts';
import {
  KEY,
  type LevelMocks,
  type MergedKeys,
  type Problem,
  keepSpies,
  mergeKeys,
  noMergedKeys,
  readMocks,
} from './mock-statements.ts';
import { printMocks } from './print-mocks.ts';

interface StoryLevel {
  story: SvelteCsfStory;
  parameters: StoryAttribute;
  object: E.ObjectExpression;
  sveltekit: E.ObjectProperty;
  beforeEach?: StoryAttribute;
  mocks: LevelMocks;
}

// Migrate the `sveltekit_experimental` parameters of a Svelte CSF file, or `null` for none.
export const migrateSvelteStories = async (
  code: string,
  id: string,
  preview: PreviewMocks & { mdxDocsPage?: boolean }
) => {
  const file = await loadSvelteCsf(code, id);
  const { module, instance, meta } = file;
  const problems: Problem[] = [];

  let metaSite: ObjectSite | undefined;
  let metaMocks: LevelMocks | undefined;
  if (module && meta?.object) {
    metaSite = findObjectSite(meta.object);
    if (metaSite) {
      metaMocks = readMocks(
        module.editor,
        metaSite.sveltekit.value,
        readContext(module.editor, module.editor, preview.merged)
      );
      problems.push(
        ...metaMocks.problems.map((problem) => ({
          ...problem,
          index: module.toFile(problem.index),
        }))
      );
      if (spreadsBeforeEach(meta.object) && metaMocks.ops.length > 0) {
        problems.push({ index: module.toFile(meta.object.start), message: SPREAD_PROBLEM });
      }
    }
  }
  for (const region of [module, instance]) {
    if (region) {
      const sites = new Set(region === module && metaSite ? [metaSite.sveltekit] : []);
      problems.push(...findUnmigrated(region.editor.program, sites, region.toFile));
    }
  }
  const unparsed = () =>
    file.unparsed(new RegExp(`\\b${KEY}\\b`, 'g')).map((index) => ({
      index,
      message: `\`${KEY}\` is outside the \`<script module>\` and the \`<Story>\` attributes, so the fix can't tell which stories use it.`,
    }));
  // Without a meta, such as in the legacy syntax, the file has no stories to migrate
  if (!module || !meta) {
    problems.push(...unparsed());
    if (problems.length > 0) {
      failWith(code, problems);
    }
    return null;
  }

  const outer = mergeKeys(
    metaMocks ? mergeKeys(preview.merged, metaMocks.merged) : preview.merged,
    migratedKeys(module.editor, meta.object && objectProperty(meta.object, 'beforeEach')?.value)
  );
  const sites: Omit<StoryLevel, 'mocks'>[] = [];
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
  const ownKeys = new Map<string, MergedKeys>();
  for (const { story, parameters, sveltekit } of sites) {
    if (story.name) {
      const context = readContext(parameters.editor, module.editor, outer, instance?.editor);
      ownKeys.set(story.name, readMocks(parameters.editor, sveltekit.value, context).merged);
    }
  }
  const stories: StoryLevel[] = sites.map((site) => {
    const storyOuter = site.story.ancestors.reduce(
      (keys, ancestor) => mergeKeys(keys, ownKeys.get(ancestor) ?? noMergedKeys()),
      outer
    );
    const mocks = readMocks(
      site.parameters.editor,
      site.sveltekit.value,
      readContext(site.parameters.editor, module.editor, storyOuter, instance?.editor)
    );
    problems.push(
      ...mocks.problems.map((problem) => ({
        ...problem,
        index: site.parameters.toFile(problem.index),
      }))
    );
    return { ...site, mocks };
  });

  problems.push(...unparsed());
  if (problems.length > 0) {
    failWith(code, problems);
  }
  if (!metaSite && stories.length === 0) {
    return null;
  }

  const levels = [...(metaMocks ? [metaMocks] : []), ...stories.map(({ mocks }) => mocks)];
  const implemented = new Set([
    ...preview.merged.functions,
    ...levels.flatMap(({ merged }) => merged.functions),
  ]);
  const kept = new Set([...implemented, ...aliasedImports(module.editor)]);
  levels.forEach((mocks) => keepSpies(mocks, kept));
  const spies = levels.flatMap(({ spies }) => spies);
  const instanceNames = instance ? [...instance.editor.scopes.program.bindings.keys()] : [];
  const imports = new MockImports(
    module.editor,
    [...takenNames(module.editor, spies), ...instanceNames],
    instanceNames
  );
  const style = styleOf(module.editor);
  const semicolon = style.semicolons ? ';' : '';
  const metaStatements = metaMocks
    ? printMocks(module.editor, metaMocks, imports.local, style)
    : [];
  const storyStatements = stories.map((story) =>
    printMocks(story.parameters.editor, story.mocks, imports.local, style)
  );
  // A docs page renders the stories inline, where they share the mocks
  const docsPage =
    !!meta.object &&
    [metaStatements, ...storyStatements].some((statements) => statements.length > 0) &&
    (!!preview.mdxDocsPage || storyAutodocs || hasAutodocs(meta.object, preview.autodocs));
  const inline = docsPage ? inlineOf(meta.object!) : undefined;
  if (inline && !isFalse(inline.value)) {
    failWith(code, [{ index: module.toFile(inline.start), message: INLINE_PROBLEM }]);
  }
  const inlineFalse = docsPage && !inline;

  if (metaSite) {
    editObjectSite(module.editor, metaSite, metaStatements, { inlineFalse, semicolon });
  } else if (inlineFalse) {
    addInlineFalseToMeta(module.editor, meta.object!);
  }
  stories.forEach((story, index) =>
    editStory(story, storyStatements[index], { semicolon, step: style.indent })
  );
  // The markup now has the stories' statements, and no longer the parameters that the fix removed
  const markup = file.markup();
  imports.apply(spies, metaSite ? [metaSite.sveltekit] : [], (name) =>
    readsName([markup, ...metaStatements], name)
  );
  return file.toString();
};

const editStory = (
  { parameters, object, sveltekit, beforeEach }: StoryLevel,
  statements: string[],
  style: { semicolon: string; step: string }
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
