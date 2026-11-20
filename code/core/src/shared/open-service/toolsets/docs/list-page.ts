import * as v from 'valibot';

import { estimateTokens } from '../estimate-tokens.ts';
import type { AllManifests } from './manifest-formatter/manifest-types.ts';

export type ListQuery = {
  withStoryIds: boolean;
  storybookIds?: string[];
};

export type ListRequest = { query: ListQuery; resume?: ListPosition };

export type ListSection = { manifests?: AllManifests };

export type ListingPage<TSection extends ListSection> = {
  sections: TSection[];
  nextCursor?: string;
};

// `seen` fingerprints the rows of `source` already delivered, so a resumed walk never skips or
// repeats one.
export type ListPosition = {
  source?: string;
  offset: number;
  seen: string;
};

const CursorPayload = v.strictObject({
  v: v.literal(1),
  ids: v.optional(v.pipe(v.array(v.string()), v.minLength(1))),
  st: v.optional(v.literal(1)),
  s: v.optional(v.string()),
  o: v.pipe(v.number(), v.integer(), v.minValue(0)),
  d: v.string(),
});

// btoa and TextEncoder rather than Buffer: the hosted handler runs in workers without Node APIs.
function encodeCursor(query: ListQuery, position: ListPosition): string {
  const payload: v.InferOutput<typeof CursorPayload> = {
    v: 1,
    ...(query.storybookIds ? { ids: query.storybookIds } : {}),
    ...(query.withStoryIds ? { st: 1 as const } : {}),
    ...(position.source !== undefined ? { s: position.source } : {}),
    o: position.offset,
    d: position.seen,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeCursor(cursor: string): { query: ListQuery; position: ListPosition } | undefined {
  try {
    const binary = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const parsed = v.safeParse(CursorPayload, JSON.parse(json));
    if (!parsed.success) {
      return undefined;
    }
    const { ids, st, s, o, d } = parsed.output;
    return {
      query: { withStoryIds: st === 1, ...(ids ? { storybookIds: ids } : {}) },
      position: { ...(s !== undefined ? { source: s } : {}), offset: o, seen: d },
    };
  } catch {
    return undefined;
  }
}

function rowKeys(section: ListSection): string[] {
  const keys = [
    ...Object.keys(section.manifests?.componentManifest.components ?? {}).map((id) => `c:${id}`),
    ...Object.keys(section.manifests?.docsManifest?.docs ?? {}).map((id) => `d:${id}`),
  ];
  return keys.length > 0 ? keys : ['!'];
}

// 32-bit FNV-1a: it detects a changed listing, it does not secure anything.
function fingerprint(keys: string[]): string {
  let hash = 0x811c9dc5;
  for (const key of keys) {
    for (let index = 0; index < key.length; index++) {
      hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
    }
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sliceSection<TSection extends ListSection>(
  section: TSection,
  rows: number,
  from: number,
  to: number
): TSection {
  if (from === 0 && to === rows) {
    return section;
  }
  const { componentManifest, docsManifest } = section.manifests!;
  const components = Object.entries(componentManifest.components);
  const docsOnPage = Object.entries(docsManifest?.docs ?? {}).slice(
    Math.max(0, from - components.length),
    Math.max(0, to - components.length)
  );
  return {
    ...section,
    manifests: {
      componentManifest: {
        ...componentManifest,
        components: Object.fromEntries(components.slice(from, to)),
      },
      ...(docsOnPage.length > 0
        ? { docsManifest: { ...docsManifest!, docs: Object.fromEntries(docsOnPage) } }
        : {}),
    },
  } as TSection;
}

const sameIds = (left: string[], right: string[]) =>
  [...new Set(left)].sort().join('\0') === [...new Set(right)].sort().join('\0');

export function readListRequest(input: {
  withStoryIds: boolean;
  storybookIds?: string[];
  cursor?: string;
}):
  | { ok: true; request: ListRequest }
  | { ok: false; refusal: 'cursor-unreadable' | 'cursor-conflict' } {
  if (input.cursor === undefined) {
    return {
      ok: true,
      request: {
        query: {
          withStoryIds: input.withStoryIds,
          ...(input.storybookIds ? { storybookIds: [...new Set(input.storybookIds)] } : {}),
        },
      },
    };
  }

  const continuation = decodeCursor(input.cursor);
  if (!continuation) {
    return { ok: false, refusal: 'cursor-unreadable' };
  }
  const { query, position } = continuation;
  // `withStoryIds: false` is also the schema default, so it cannot conflict with a cursor.
  if (
    (input.storybookIds !== undefined && !sameIds(input.storybookIds, query.storybookIds ?? [])) ||
    (input.withStoryIds && !query.withStoryIds)
  ) {
    return { ok: false, refusal: 'cursor-conflict' };
  }
  return { ok: true, request: { query, resume: position } };
}

export function pageListing<TSection extends ListSection>(
  sections: readonly TSection[],
  options: {
    request: ListRequest;
    keyOf: (section: TSection) => string | undefined;
    render: (page: ListingPage<TSection>) => string;
    tokenBudget: number;
  }
):
  | { ok: true; page: ListingPage<TSection>; markdown: string; tokenCount: number }
  | { ok: false; refusal: 'cursor-stale' } {
  const { request, keyOf, render, tokenBudget } = options;
  const keys = sections.map(rowKeys);
  const starts: number[] = [];
  let total = 0;
  for (const sectionKeys of keys) {
    starts.push(total);
    total += sectionKeys.length;
  }

  let start = 0;
  if (request.resume) {
    const { source, offset, seen } = request.resume;
    const index = sections.findIndex((section) => keyOf(section) === source);
    if (
      index === -1 ||
      offset >= keys[index].length ||
      fingerprint(keys[index].slice(0, offset)) !== seen
    ) {
      return { ok: false, refusal: 'cursor-stale' };
    }
    start = starts[index] + offset;
  }

  const pageTo = (end: number): ListingPage<TSection> => {
    const onPage: TSection[] = [];
    sections.forEach((section, index) => {
      const rows = keys[index].length;
      const from = Math.max(start, starts[index]) - starts[index];
      const to = Math.min(end, starts[index] + rows) - starts[index];
      if (from < to) {
        onPage.push(sliceSection(section, rows, from, to));
      }
    });
    if (end === total) {
      return { sections: onPage };
    }
    const next = starts.findLastIndex((sectionStart) => sectionStart <= end);
    const offset = end - starts[next];
    return {
      sections: onPage,
      nextCursor: encodeCursor(request.query, {
        source: keyOf(sections[next]),
        offset,
        seen: fingerprint(keys[next].slice(0, offset)),
      }),
    };
  };

  const measure = (end: number) => {
    const page = pageTo(end);
    const markdown = render(page);
    return { ok: true as const, page, markdown, tokenCount: estimateTokens(markdown) };
  };

  const whole = measure(total);
  if (whole.tokenCount <= tokenBudget || total - start === 1) {
    return whole;
  }

  let best = measure(start + 1);
  let low = start + 1;
  let high = total - 1;
  let step = 1;
  while (low + step <= high) {
    const candidate = measure(low + step);
    if (candidate.tokenCount > tokenBudget) {
      high = low + step - 1;
      break;
    }
    best = candidate;
    low += step;
    step *= 2;
  }
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = measure(middle);
    if (candidate.tokenCount <= tokenBudget) {
      best = candidate;
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return best;
}
