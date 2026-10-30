import { MINIMAL_VIEWPORTS, type ViewportParameters } from 'storybook/viewport';

import { resolveViewport } from '../../../../core/src/viewport/resolveViewport.ts';
import type { StoryArgs } from './page-model.ts';

export type DocsViewportParameter = ViewportParameters['viewport'] | undefined;

export const DOCS_FRAME_ALIGN = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'flex-start',
} as const;

export type DocsFrameStyle = {
  width: string;
  minWidth: string;
  maxWidth: string;
  flexShrink: 0;
  alignSelf: 'flex-start';
  display: 'block';
};

/**
 * The frame width the viewport tool selects for one instance, resolved the way the story canvas
 * resolves it. The viewport height is not returned: the frame's `height` and `ratio` own its height.
 */
export function docsFrameWidth(globals: StoryArgs, parameter?: DocsViewportParameter): string {
  return resolveViewport({
    globals,
    userGlobals: globals,
    storyGlobals: {},
    options: parameter?.options ?? MINIMAL_VIEWPORTS,
    disable: parameter?.disable,
    viewMode: 'story',
  }).width;
}

export function docsFrameStyle(width: string): DocsFrameStyle {
  return {
    width,
    minWidth: width.endsWith('%') ? '0' : width,
    maxWidth: width,
    flexShrink: 0,
    alignSelf: 'flex-start',
    display: 'block',
  };
}
