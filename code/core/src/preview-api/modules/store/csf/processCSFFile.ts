import { logger } from 'storybook/internal/client-logger';
import type { Story } from 'storybook/internal/csf';
import { getStoryChildren, isExportStory, isStory, toTestId } from 'storybook/internal/csf';
import type { ComponentTitle, Parameters, Path, Renderer } from 'storybook/internal/types';
import type {
  CSFFile,
  ModuleExports,
  NormalizedComponentAnnotations,
} from 'storybook/internal/types';

import { normalizeComponentAnnotations } from './normalizeComponentAnnotations';
import { normalizeStory } from './normalizeStory';

const checkGlobals = (parameters: Parameters) => {
  const { globals, globalTypes } = parameters;
  if (globals || globalTypes) {
    logger.error(
      'Global args/argTypes can only be set globally',
      JSON.stringify({
        globals,
        globalTypes,
      })
    );
  }
};

const checkStorySort = (parameters: Parameters) => {
  const { options } = parameters;

  if (options?.storySort) {
    logger.error('The storySort option parameter can only be set globally');
  }
};

const checkDisallowedParameters = (parameters?: Parameters) => {
  if (!parameters) {
    return;
  }

  checkGlobals(parameters);
  checkStorySort(parameters);
};

// Given the raw exports of a CSF file, check and normalize it.
export function processCSFFile<TRenderer extends Renderer>(
  moduleExports: ModuleExports,
  importPath: Path,
  title: ComponentTitle
): CSFFile<TRenderer> {
  const { default: defaultExport, __namedExportsOrder, ...namedExports } = moduleExports;

  const factoryStory = Object.values(namedExports).find((it) => isStory<TRenderer>(it));
  if (factoryStory) {
    const meta: NormalizedComponentAnnotations<TRenderer> =
      normalizeComponentAnnotations<TRenderer>(factoryStory.meta.input, title, importPath);
    checkDisallowedParameters(meta.parameters);

    const csfFile: CSFFile<TRenderer> = { meta, stories: {}, moduleExports };

    Object.keys(namedExports).forEach((key) => {
      if (isExportStory(key, meta) && isStory<TRenderer>(namedExports[key])) {
        const story: Story<TRenderer> = namedExports[key];

        const storyMeta = normalizeStory(key, story.input as any, meta);
        checkDisallowedParameters(storyMeta.parameters);

        csfFile.stories[storyMeta.id] = storyMeta;

        // if the story has tests, we need to add those to the csfFile

        getStoryChildren(story).forEach((child) => {
          const name = child.input.name!;
          const childId = toTestId(storyMeta.id, name);

          child.input.parameters ??= {};
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore We provide the __id parameter because we don't want normalizeStory to calculate the id
          child.input.parameters.__id = childId;

          csfFile.stories[childId] = normalizeStory(name, child.input as any, meta);
        });
      }
    });

    csfFile.projectAnnotations = factoryStory.meta.preview.composed;

    return csfFile;
  }

  const meta: NormalizedComponentAnnotations<TRenderer> = normalizeComponentAnnotations<TRenderer>(
    defaultExport,
    title,
    importPath
  );
  checkDisallowedParameters(meta.parameters);

  const csfFile: CSFFile<TRenderer> = { meta, stories: {}, moduleExports };

  Object.keys(namedExports).forEach((key) => {
    if (isExportStory(key, meta)) {
      const storyMeta = normalizeStory(key, namedExports[key], meta);
      checkDisallowedParameters(storyMeta.parameters);

      csfFile.stories[storyMeta.id] = storyMeta;
    }
  });

  return csfFile;
}
