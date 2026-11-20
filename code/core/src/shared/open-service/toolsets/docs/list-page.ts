import type { AllManifests } from './manifest-formatter/manifest-types.ts';

export type ListQuery = {
  withStoryIds: boolean;
  storybookIds?: string[];
};

declare const listPosition: unique symbol;

export type ListPosition = { readonly [listPosition]: never };

export type ListRequest = { query: ListQuery; resume?: ListPosition };

export type ListSection = { manifests?: AllManifests };

export type ListingPage<TSection extends ListSection> = {
  sections: TSection[];
  nextCursor?: string;
};

export function readListRequest(_input: {
  withStoryIds: boolean;
  storybookIds?: string[];
  cursor?: string;
}):
  | { ok: true; request: ListRequest }
  | { ok: false; refusal: 'cursor-unreadable' | 'cursor-conflict' } {
  throw new Error('not implemented');
}

export function pageListing<TSection extends ListSection>(
  _sections: readonly TSection[],
  _options: {
    request: ListRequest;
    keyOf: (section: TSection) => string | undefined;
    render: (page: ListingPage<TSection>) => string;
    tokenBudget: number;
  }
):
  | { ok: true; page: ListingPage<TSection>; markdown: string; tokenCount: number }
  | { ok: false; refusal: 'cursor-stale' } {
  throw new Error('not implemented');
}
