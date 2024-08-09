import type { ViewMode } from '@storybook/core/types';
import { global } from '@storybook/global';

import qs from 'qs';

import type { Selection, SelectionSpecifier, SelectionStore } from './SelectionStore';
import { parseArgsParam } from './parseArgsParam';

const { history, document } = global;

export function pathToId(path: string) {
  const match = (path || '').match(/^\/story\/(.+)/);
  if (!match) {
    throw new Error(`Invalid path '${path}',  must start with '/story/'`);
  }
  return match[1];
}

const getQueryString = ({
  selection,
  extraParams,
}: {
  selection?: Selection;
  extraParams?: qs.ParsedQs;
}) => {
  const search = typeof document !== 'undefined' ? document.location.search : '';
  const { path, selectedKind, selectedStory, ...rest } = qs.parse(search, {
    ignoreQueryPrefix: true,
  });
  return qs.stringify(
    {
      ...rest,
      ...extraParams,
      ...(selection && { id: selection.storyId, viewMode: selection.viewMode }),
    },
    { encode: false, addQueryPrefix: true }
  );
};

export const setPath = (selection?: Selection) => {
  if (!selection) return;
  const query = getQueryString({ selection });
  const { hash = '' } = document.location;
  document.title = selection.storyId;
  history.replaceState({}, '', `${document.location.pathname}${query}${hash}`);
};

type ValueOf<T> = T[keyof T];
const isObject = (val: Record<string, any>) =>
  val != null && typeof val === 'object' && Array.isArray(val) === false;

const getFirstString = (v: ValueOf<qs.ParsedQs>): string | void => {
  if (v === undefined) {
    return undefined;
  }
  if (typeof v === 'string') {
    return v;
  }
  if (Array.isArray(v)) {
    return getFirstString(v[0]);
  }
  if (isObject(v)) {
    return getFirstString(Object.values(v).filter(Boolean) as string[]);
  }
  return undefined;
};

export const getSelectionSpecifierFromPath: () => SelectionSpecifier | null = () => {
  if (typeof document !== 'undefined') {
    const query = qs.parse(document.location.search, { ignoreQueryPrefix: true });
    const args = typeof query.args === 'string' ? parseArgsParam(query.args) : undefined;
    const globals = typeof query.globals === 'string' ? parseArgsParam(query.globals) : undefined;

    let viewMode = getFirstString(query.viewMode) as ViewMode;
    if (typeof viewMode !== 'string' || !viewMode.match(/docs|story/)) {
      viewMode = 'story';
    }

    const path = getFirstString(query.path);
    const storyId = path ? pathToId(path) : getFirstString(query.id);

    if (storyId) {
      return { storySpecifier: storyId, args, globals, viewMode };
    }
  }

  return null;
};

export class UrlStore implements SelectionStore {
  selectionSpecifier: SelectionSpecifier | null;

  selection?: Selection;

  constructor() {
    this.selectionSpecifier = getSelectionSpecifierFromPath();
  }

  setSelection(selection: Selection) {
    this.selection = selection;
    setPath(this.selection);
  }

  setQueryParams(queryParams: qs.ParsedQs) {
    const query = getQueryString({ extraParams: queryParams });
    const { hash = '' } = document.location;
    history.replaceState({}, '', `${document.location.pathname}${query}${hash}`);
  }
}
