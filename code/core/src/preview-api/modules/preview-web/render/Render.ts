import type { Renderer, StoryId } from '@storybook/core/types';
import type { StoryRenderOptions } from '@storybook/core/types';

export type RenderType = 'story' | 'docs';

/**
 * A "Render" represents the rendering of a single entry to a single location
 *
 * The implementations of render are used for two key purposes:
 *
 * - Tracking the state of the rendering as it moves between preparing, rendering and tearing down.
 * - Tracking what is rendered to know if a change requires re-rendering or teardown + recreation.
 */
export interface Render<TRenderer extends Renderer> {
  type: RenderType;
  id: StoryId;
  isPreparing: () => boolean;
  isEqual: (other: Render<TRenderer>) => boolean;
  disableKeyListeners: boolean;
  teardown?: (options: { viewModeChanged: boolean }) => Promise<void>;
  torndown: boolean;
  renderToElement: (
    canvasElement: TRenderer['canvasElement'],
    renderStoryToElement?: any,
    options?: StoryRenderOptions
  ) => Promise<void>;
}

export const PREPARE_ABORTED = new Error('prepareAborted');
