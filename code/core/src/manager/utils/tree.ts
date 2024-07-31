import memoize from 'memoizerific';
import { global } from '@storybook/global';
import type { SyntheticEvent } from 'react';
import type { HashEntry, IndexHash } from '@storybook/core/manager-api';

import { DEFAULT_REF_ID } from '../components/sidebar/Sidebar';
import type { Item, RefType, Dataset, SearchItem } from '../components/sidebar/types';

const { document, window: globalWindow } = global;

export const createId = (itemId: string, refId?: string) =>
  !refId || refId === DEFAULT_REF_ID ? itemId : `${refId}_${itemId}`;

export const getLink = (item: HashEntry, refId?: string) => {
  return `${document.location.pathname}?path=/${item.type}/${createId(item.id, refId)}`;
};

export const prevent = (e: SyntheticEvent) => {
  e.preventDefault();
  return false;
};

export const get = memoize(1000)((id: string, dataset: Dataset) => dataset[id]);
export const getParent = memoize(1000)((id: string, dataset: Dataset) => {
  const item = get(id, dataset);
  return item && item.type !== 'root' ? get(item.parent as string, dataset) : undefined;
});
export const getParents = memoize(1000)((id: string, dataset: Dataset): Item[] => {
  const parent = getParent(id, dataset);
  return parent ? [parent, ...getParents(parent.id, dataset)] : [];
});
export const getAncestorIds = memoize(1000)((data: IndexHash, id: string): string[] =>
  getParents(id, data).map((item) => item.id)
);
export const getDescendantIds = memoize(1000)((
  data: IndexHash,
  id: string,
  skipLeafs: boolean
): string[] => {
  const entry = data[id];
  const children = entry.type === 'story' || entry.type === 'docs' ? [] : entry.children;
  return children.reduce((acc, childId) => {
    const child = data[childId];
    if (!child || (skipLeafs && (child.type === 'story' || child.type === 'docs'))) return acc;
    acc.push(childId, ...getDescendantIds(data, childId, skipLeafs));
    return acc;
  }, [] as string[]);
});

export function getPath(item: Item, ref: RefType): string[] {
  // @ts-expect-error (non strict)
  const parent = item.type !== 'root' && item.parent ? ref.index[item.parent] : null;
  if (parent) return [...getPath(parent, ref), parent.name];
  return ref.id === DEFAULT_REF_ID ? [] : [ref.title || ref.id];
}

export const searchItem = (item: Item, ref: RefType): SearchItem => {
  return { ...item, refId: ref.id, path: getPath(item, ref) };
};

export function cycle<T>(array: T[], index: number, delta: number): number {
  let next = index + (delta % array.length);
  if (next < 0) next = array.length + next;
  if (next >= array.length) next -= array.length;
  return next;
}

export const scrollIntoView = (element: Element, center = false) => {
  if (!element) return;
  const { top, bottom } = element.getBoundingClientRect();
  const isInView =
    top >= 0 && bottom <= (globalWindow.innerHeight || document.documentElement.clientHeight);
  if (!isInView) element.scrollIntoView({ block: center ? 'center' : 'nearest' });
};

export const getStateType = (
  isLoading: boolean,
  isAuthRequired: boolean,
  isError: boolean,
  isEmpty: boolean
) => {
  switch (true) {
    case isAuthRequired:
      return 'auth';
    case isError:
      return 'error';
    case isLoading:
      return 'loading';
    case isEmpty:
      return 'empty';
    default:
      return 'ready';
  }
};

export const isAncestor = (element?: Element, maybeAncestor?: Element): boolean => {
  if (!element || !maybeAncestor) return false;
  if (element === maybeAncestor) return true;
  return isAncestor(element.parentElement || undefined, maybeAncestor);
};

export const removeNoiseFromName = (storyName: string) => storyName.replaceAll(/(\s|-|_)/gi, '');

export const isStoryHoistable = (storyName: string, componentName: string) =>
  removeNoiseFromName(storyName) === removeNoiseFromName(componentName);
