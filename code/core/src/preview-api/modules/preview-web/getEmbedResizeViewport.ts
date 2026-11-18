import type { Renderer } from 'storybook/internal/types';

import { PARAM_KEY } from '../../../viewport/constants.ts';
import { MINIMAL_VIEWPORTS } from '../../../viewport/defaults.ts';
import {
  resolveViewport,
  toResolvedViewportDimensions,
  type ResolvedViewportDimensions,
} from '../../../viewport/resolveViewport.ts';
import type { ViewportParameters } from '../../../viewport/types.ts';
import type { StoryStore } from '../store/StoryStore.ts';
import type { StoryRender } from './render/StoryRender.ts';

export const getEmbedResizeViewport = <TRenderer extends Renderer>(
  storyStore: StoryStore<TRenderer> | undefined,
  render: StoryRender<TRenderer> | undefined,
  reference: { width: number; height: number }
): ResolvedViewportDimensions | undefined => {
  if (!storyStore || !render?.story) {
    return undefined;
  }

  const { globals, storyGlobals, userGlobals, parameters } = storyStore.getStoryContext(
    render.story
  );
  const viewportParameters = parameters[PARAM_KEY] as ViewportParameters['viewport'];

  return toResolvedViewportDimensions(
    resolveViewport({
      globals,
      storyGlobals,
      userGlobals,
      options: viewportParameters?.options ?? MINIMAL_VIEWPORTS,
      disable: viewportParameters?.disable ?? false,
      viewMode: 'story',
    }),
    reference
  );
};
