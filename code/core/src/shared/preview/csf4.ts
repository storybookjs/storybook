import componentTestingAnnotations from 'storybook/internal/component-testing/preview';
import type {
  ComponentAnnotations,
  Meta,
  Preview,
  Renderer,
  Story,
  StoryAnnotations,
} from 'storybook/internal/csf';
import type { NormalizedProjectAnnotations } from 'storybook/internal/types';

import actionAnnotations from 'storybook/actions/preview';
import { composeConfigs, normalizeProjectAnnotations } from 'storybook/preview-api';
import testAnnotations from 'storybook/test/preview';

/** Do not use, use the definePreview exported from the framework instead. */
// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
export function __definePreview<TRenderer extends Renderer>(
  input: Preview<TRenderer>['input']
): Preview<TRenderer> {
  let composed: NormalizedProjectAnnotations<TRenderer>;
  const preview: Preview<TRenderer> = {
    _tag: 'Preview',
    input,
    get composed() {
      if (composed) {
        return composed;
      }
      const { addons, ...rest } = input;
      composed = normalizeProjectAnnotations<TRenderer>(
        // TODO: Remove coreAnnotations once csf-factories use prepareStory (as core annotations already come from it)
        composeConfigs([
          // @ts-expect-error CJS fallback
          (actionAnnotations.default ?? actionAnnotations)(),
          // @ts-expect-error CJS fallback
          (componentTestingAnnotations.default ?? componentTestingAnnotations)(),
          // @ts-expect-error CJS fallback
          (testAnnotations.default ?? testAnnotations)(),
          ...(addons ?? []),
          rest,
        ])
      );
      return composed;
    },
    meta(meta: ComponentAnnotations<TRenderer>) {
      return defineMeta(meta, this);
    },
  };
  globalThis.globalProjectAnnotations = preview.composed;
  return preview;
}

function defineMeta<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer>,
  preview: Preview<TRenderer>
): Meta<TRenderer> {
  return {
    _tag: 'Meta',
    input,
    preview,
    get composed(): never {
      throw new Error('Not implemented');
    },
    story(story: StoryAnnotations<TRenderer>) {
      return defineStory(story, this);
    },
  };
}

function defineStory<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer>,
  meta: Meta<TRenderer>
): Story<TRenderer> {
  return {
    _tag: 'Story',
    input,
    meta,
    get composed(): never {
      throw new Error('Not implemented');
    },
  };
}
