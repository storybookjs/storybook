import type { ViewMode } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { parse, stringify } from 'picoquery';

import type { Selection, SelectionSpecifier, SelectionStore } from './SelectionStore.ts';
import { parseArgsParam } from './parseArgsParam.ts';

const { history, document } = global;

/**
 * TODO: Remove in SB11
 *
 * Preview selection should only use `?id=` / `?viewMode=`. Reading manager-style
 * `?path=/<viewMode>/<storyId>` is legacy compatibility (`setPath` already writes id/viewMode).
 *
 * The manager builds its hrefs as `?path=/<viewMode>/<storyId>`, so the prefix carries the view
 * mode and is the only mode signal that form has. `?viewMode=` is only ever set alongside `?id=`.
 */
const PATH_REGEX = /^\/(story|docs)\/(.+)/;

export function pathToId(path: string) {
  const match = (path || '').match(PATH_REGEX);
  if (!match) {
    throw new Error(`Invalid path '${path}',  must start with '/story/' or '/docs/'`);
  }
  return match[2];
}

function pathToViewMode(path: string): ViewMode | undefined {
  return (path || '').match(PATH_REGEX)?.[1] as ViewMode | undefined;
}

const getQueryString = ({
  search = document?.location.search,
  selection,
  extraParams,
}: {
  search?: string;
  selection?: Selection;
  extraParams?: Record<PropertyKey, unknown>;
}) => {
  const { path, selectedKind, selectedStory, ...rest } = parse(search.slice(1));
  const queryStr = stringify({
    ...rest,
    ...extraParams,
    ...(selection && { id: selection.storyId, viewMode: selection.viewMode }),
  });
  return `?${queryStr}`;
};

export const setPath = (selection?: Selection, pathname = document.location.pathname) => {
  if (!selection) {
    return undefined;
  }
  const query = getQueryString({ selection });
  const { hash = '' } = document.location;
  document.title = selection.storyId;
  const url = `${pathname}${query}${hash}`;
  history.replaceState({}, '', url);
  return url;
};

type ValueOf<T> = T[keyof T];
const isObject = (val: Record<string, any>): val is object =>
  val != null && typeof val === 'object' && Array.isArray(val) === false;

const getFirstString = (v: ValueOf<Record<PropertyKey, unknown>>): string | void => {
  if (v === undefined) {
    return undefined;
  }
  if (typeof v === 'string') {
    return v;
  }
  if (Array.isArray(v)) {
    return getFirstString(v[0]);
  }
  if (isObject(v as Record<PropertyKey, unknown>)) {
    return getFirstString(
      Object.values(v as Record<PropertyKey, unknown>).filter(Boolean) as string[]
    );
  }
  return undefined;
};

export const getSelectionSpecifierFromPath: () => SelectionSpecifier | null = () => {
  if (typeof document !== 'undefined') {
    const queryStr = document.location.search.slice(1);
    const query = parse(queryStr);
    const args = typeof query.args === 'string' ? parseArgsParam(query.args) : undefined;
    const globals = typeof query.globals === 'string' ? parseArgsParam(query.globals) : undefined;

    const path = getFirstString(query.path);

    let viewMode = getFirstString(query.viewMode) as ViewMode;
    if (typeof viewMode !== 'string' || !viewMode) {
      viewMode = (path && pathToViewMode(path)) || 'story';
    } else if (!viewMode.match(/docs|story/)) {
      return null;
    }

    const storyId = path ? pathToId(path) : getFirstString(query.id);

    if (storyId) {
      return { storySpecifier: storyId, args, globals, viewMode };
    }
  }

  return null;
};

type OwnQuery = { search: string; hash: string };

// Compared as parsed URLs: the browser may encode a query differently than the store wrote it.
const parseUrl = (url: string) => new URL(url, 'http://localhost');

export class UrlStore implements SelectionStore {
  selectionSpecifier: SelectionSpecifier | null;

  selection?: Selection;

  url?: string;

  // A story may change `location`; the preview stays at the path it was loaded from.
  private pathname = document?.location.pathname;

  // The preview's own query and hash, while `location` is lent to a story.
  private ownQuery?: OwnQuery;

  constructor() {
    this.selectionSpecifier = getSelectionSpecifierFromPath();
  }

  setSelection(selection: Selection) {
    this.selection = selection;
    if (this.ownQuery) {
      this.updateOwnQuery(this.ownQuery, { selection });
      return;
    }
    this.url = setPath(this.selection, this.pathname);
  }

  setQueryParams(queryParams: Record<PropertyKey, unknown>) {
    if (this.ownQuery) {
      this.updateOwnQuery(this.ownQuery, { extraParams: queryParams });
      return;
    }
    const query = getQueryString({ extraParams: queryParams });
    const { hash = '' } = document.location;
    history.replaceState({}, '', `${document.location.pathname}${query}${hash}`);
    // The URL of the selected story carries the params too, so the story keeps them on a reload.
    if (this.selection) {
      const storyQuery = getQueryString({ selection: this.selection, extraParams: queryParams });
      this.url = `${this.pathname}${storyQuery}${hash}`;
    }
  }

  lendLocation() {
    if (this.ownQuery || !this.url) {
      return;
    }
    const { search, hash } = parseUrl(this.url);
    this.ownQuery = { search, hash };
  }

  // A story, or its teardown, may have moved `location`. After the teardown the document is at the
  // URL of the selected story, so the next render and a reload start there.
  reclaimLocation() {
    this.ownQuery = undefined;
    const { pathname, search, hash = '' } = document.location;
    if (this.url && parseUrl(this.url).href !== parseUrl(`${pathname}${search}${hash}`).href) {
      history.replaceState({}, '', this.url);
    }
    if (this.selection) {
      document.title = this.selection.storyId;
    }
  }

  private updateOwnQuery(ownQuery: OwnQuery, params: Parameters<typeof getQueryString>[0]) {
    ownQuery.search = getQueryString({ ...params, search: ownQuery.search });
    this.url = `${this.pathname}${ownQuery.search}${ownQuery.hash}`;
  }
}
