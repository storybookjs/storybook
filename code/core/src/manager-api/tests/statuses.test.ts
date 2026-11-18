import { describe, expect, it, vi } from 'vitest';

import type { API_PreparedIndexEntry } from 'storybook/internal/types';

import {
  computeStatusFilterFn,
  parseStatusesParam,
  serializeStatusesParam,
} from '../modules/statuses.ts';

vi.mock('../stores/status.ts', () => ({
  fullStatusStore: {
    getAll: vi.fn(() => ({})),
  },
}));

import { fullStatusStore } from '../stores/status.ts';

const entry = (id: string): API_PreparedIndexEntry => ({ id }) as unknown as API_PreparedIndexEntry;

describe('parseStatusesParam', () => {
  it('returns empty arrays for undefined', () => {
    expect(parseStatusesParam(undefined)).toEqual({ included: [], excluded: [] });
  });

  it('returns empty arrays for empty string', () => {
    expect(parseStatusesParam('')).toEqual({ included: [], excluded: [] });
  });

  it('parses included statuses', () => {
    expect(parseStatusesParam('new;modified')).toEqual({
      included: ['status-value:new', 'status-value:modified'],
      excluded: [],
    });
  });

  it('parses excluded statuses with ! prefix', () => {
    expect(parseStatusesParam('!error;!warning')).toEqual({
      included: [],
      excluded: ['status-value:error', 'status-value:warning'],
    });
  });

  it('parses mixed included and excluded', () => {
    expect(parseStatusesParam('new;!error;pending')).toEqual({
      included: ['status-value:new', 'status-value:pending'],
      excluded: ['status-value:error'],
    });
  });

  it('ignores unknown short names', () => {
    expect(parseStatusesParam('new;bogus;modified')).toEqual({
      included: ['status-value:new', 'status-value:modified'],
      excluded: [],
    });
  });

  it('ignores empty segments from trailing semicolons', () => {
    expect(parseStatusesParam('new;;modified;')).toEqual({
      included: ['status-value:new', 'status-value:modified'],
      excluded: [],
    });
  });

  it('parses all known status values', () => {
    expect(
      parseStatusesParam('new;modified;related;error;warning;success;pending;unknown')
    ).toEqual({
      included: [
        'status-value:new',
        'status-value:modified',
        'status-value:affected',
        'status-value:error',
        'status-value:warning',
        'status-value:success',
        'status-value:pending',
        'status-value:unknown',
      ],
      excluded: [],
    });
  });

  it('keeps backward compatibility for affected in URL params', () => {
    expect(parseStatusesParam('affected')).toEqual({
      included: ['status-value:affected'],
      excluded: [],
    });
  });
});

describe('serializeStatusesParam', () => {
  it('returns undefined for empty arrays', () => {
    expect(serializeStatusesParam([], [])).toBeUndefined();
  });

  it('serializes included values', () => {
    expect(serializeStatusesParam(['status-value:new', 'status-value:modified'], [])).toBe(
      'modified;new'
    );
  });

  it('serializes excluded values with ! prefix', () => {
    expect(serializeStatusesParam([], ['status-value:error', 'status-value:warning'])).toBe(
      '!error;!warning'
    );
  });

  it('serializes mixed included and excluded', () => {
    expect(serializeStatusesParam(['status-value:new'], ['status-value:error'])).toBe('new;!error');
  });

  it('serializes affected as related for URL params', () => {
    expect(serializeStatusesParam(['status-value:affected'], [])).toBe('related');
    expect(serializeStatusesParam([], ['status-value:affected'])).toBe('!related');
  });

  it('round-trips with parseStatusesParam', () => {
    const included = ['status-value:new', 'status-value:pending'] as const;
    const excluded = ['status-value:error'] as const;
    const serialized = serializeStatusesParam([...included], [...excluded]);
    const parsed = parseStatusesParam(serialized);
    expect(parsed.included).toEqual(included);
    expect(parsed.excluded).toEqual(excluded);
  });
});

describe('computeStatusFilterFn', () => {
  it('returns true for all entries when both filters are empty', () => {
    const fn = computeStatusFilterFn([], []);
    expect(fn(entry('story-1') as any)).toBe(true);
  });

  it('includes entries matching an included status (OR logic)', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({
      'story-1': {
        'addon-a': {
          value: 'status-value:new',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-1',
        },
      },
      'story-2': {
        'addon-a': {
          value: 'status-value:error',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-2',
        },
      },
    });

    const fn = computeStatusFilterFn(['status-value:new', 'status-value:modified'], []);
    expect(fn(entry('story-1') as any)).toBe(true); // has 'new'
    expect(fn(entry('story-2') as any)).toBe(false); // has 'error', not in include list
  });

  it('excludes entries matching an excluded status (AND logic)', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({
      'story-1': {
        'addon-a': {
          value: 'status-value:error',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-1',
        },
      },
      'story-2': {
        'addon-a': {
          value: 'status-value:success',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-2',
        },
      },
    });

    const fn = computeStatusFilterFn([], ['status-value:error']);
    expect(fn(entry('story-1') as any)).toBe(false); // has 'error', excluded
    expect(fn(entry('story-2') as any)).toBe(true); // has 'success', not excluded
  });

  it('applies both include and exclude filters together', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({
      'story-1': {
        'addon-a': {
          value: 'status-value:new',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-1',
        },
      },
      'story-2': {
        'addon-a': {
          value: 'status-value:new',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-2',
        },
        'addon-b': {
          value: 'status-value:error',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-2',
        },
      },
      'story-3': {
        'addon-a': {
          value: 'status-value:success',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-3',
        },
      },
    });

    const fn = computeStatusFilterFn(['status-value:new'], ['status-value:error']);
    expect(fn(entry('story-1') as any)).toBe(true); // included via 'new', no excluded match
    expect(fn(entry('story-2') as any)).toBe(false); // included via 'new' BUT excluded via 'error'
    expect(fn(entry('story-3') as any)).toBe(false); // not included (no 'new')
  });

  it('excludes entries with no statuses when include filters are active', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({});

    const fn = computeStatusFilterFn(['status-value:new'], []);
    expect(fn(entry('story-no-status') as any)).toBe(false);
  });

  it('includes entries with no statuses when only exclude filters are active', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({});

    const fn = computeStatusFilterFn([], ['status-value:error']);
    expect(fn(entry('story-no-status') as any)).toBe(true);
  });

  it('handles entry not present in status store', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({
      'other-story': {
        'addon-a': {
          value: 'status-value:new',
          title: '',
          description: '',
          typeId: '',
          storyId: 'other-story',
        },
      },
    });

    const fn = computeStatusFilterFn(['status-value:new'], []);
    expect(fn(entry('missing-story') as any)).toBe(false);
  });

  it('handles entry with multiple statuses from different addons', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue({
      'story-1': {
        'addon-a': {
          value: 'status-value:warning',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-1',
        },
        'addon-b': {
          value: 'status-value:new',
          title: '',
          description: '',
          typeId: '',
          storyId: 'story-1',
        },
      },
    });

    const fn = computeStatusFilterFn(['status-value:new'], []);
    expect(fn(entry('story-1') as any)).toBe(true); // one of its statuses matches
  });

  it('handles null return from getAll', () => {
    vi.mocked(fullStatusStore.getAll).mockReturnValue(null as any);

    const fn = computeStatusFilterFn(['status-value:new'], []);
    expect(fn(entry('story-1') as any)).toBe(false);
  });
});
