import { getStoryHref } from 'storybook/internal/components';

import { global } from '@storybook/global';

import type { ModuleFn } from '../lib/types';

const { PREVIEW_URL, document } = global;

/** The API for opening stories in isolation mode. */
export interface SubAPI {
  /**
   * Opens a story in isolation mode in a new tab/window.
   *
   * @param storyId - The ID of the story to open.
   * @param refId - The ID of the ref for the story. If not provided, uses the local Storybook ref.
   * @param viewMode - The view mode to open the story in. If not provided, uses the current view
   *   mode.
   */
  openInIsolation: (storyId: string, refId?: string | null, viewMode?: 'story' | 'docs') => void;
}

export const init: ModuleFn = ({ store }) => {
  const api: SubAPI = {
    openInIsolation(storyId: string, refId?: string | null, viewMode?: 'story' | 'docs'): void {
      const { location } = document;
      const { refs, customQueryParams, viewMode: currentViewMode } = store.getState();

      // Account for local and external stories
      const ref = refId ? refs[refId] : null;

      let baseUrl = `${location.origin}${location.pathname}`;

      if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
      }

      const iframeUrl = ref
        ? `${ref.url}/iframe.html`
        : (PREVIEW_URL as string) || `${baseUrl}iframe.html`;

      const storyViewMode = viewMode ?? currentViewMode;

      const href = getStoryHref(iframeUrl, storyId, {
        ...customQueryParams,
        ...(storyViewMode && { viewMode: storyViewMode }),
      });
      window.open(href, '_blank', 'noopener,noreferrer');
    },
  };

  return {
    api,
    state: {},
  };
};
