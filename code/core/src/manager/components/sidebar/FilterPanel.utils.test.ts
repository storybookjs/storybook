import { describe, expect, it } from 'vitest';

import { computeFilterTelemetryPayload } from './FilterPanel.utils.ts';

const BUILT_IN_ENTRIES = [
  { id: '_docs', count: 5 },
  { id: '_play', count: 3 },
  { id: '_test', count: 7 },
];

const STATUS_ENTRIES = [
  { statusValue: 'status-value:new', count: 2 },
  { statusValue: 'status-value:modified', count: 4 },
];

const BASE_STATE = {
  builtInEntries: BUILT_IN_ENTRIES,
  statusEntries: STATUS_ENTRIES,
  includedTagFilters: [],
  excludedTagFilters: [],
  includedStatusFilters: [] as string[],
  excludedStatusFilters: [] as string[],
};

describe('computeFilterTelemetryPayload', () => {
  describe('tag filter — include action', () => {
    it('adds the filter to activeTagFilters.included in the payload', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'include' },
        BASE_STATE
      );

      expect(payload.activeTagFilters.included).toEqual(['_docs']);
      expect(payload.activeTagFilters.excluded).toEqual([]);
    });

    it('includes the story count for the newly included filter', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'include' },
        BASE_STATE
      );

      expect(payload.storyCounts).toEqual({ _docs: 5 });
    });

    it('moves a previously excluded filter to included', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'include' },
        { ...BASE_STATE, excludedTagFilters: ['_docs'] }
      );

      expect(payload.activeTagFilters.included).toEqual(['_docs']);
      expect(payload.activeTagFilters.excluded).toEqual([]);
    });

    it('preserves other active filters', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_play', action: 'include' },
        { ...BASE_STATE, includedTagFilters: ['_docs'] }
      );

      expect(payload.activeTagFilters.included).toEqual(['_docs', '_play']);
      expect(payload.storyCounts).toEqual({ _docs: 5, _play: 3 });
    });
  });

  describe('tag filter — exclude action', () => {
    it('adds the filter to activeTagFilters.excluded in the payload', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'exclude' },
        BASE_STATE
      );

      expect(payload.activeTagFilters.excluded).toEqual(['_docs']);
      expect(payload.activeTagFilters.included).toEqual([]);
    });

    it('moves a previously included filter to excluded', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'exclude' },
        { ...BASE_STATE, includedTagFilters: ['_docs'] }
      );

      expect(payload.activeTagFilters.included).toEqual([]);
      expect(payload.activeTagFilters.excluded).toEqual(['_docs']);
    });
  });

  describe('tag filter — remove action', () => {
    it('removes the filter from activeTagFilters.included', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'remove' },
        { ...BASE_STATE, includedTagFilters: ['_docs', '_play'] }
      );

      expect(payload.activeTagFilters.included).toEqual(['_play']);
      expect(payload.storyCounts).toEqual({ _play: 3 });
    });

    it('removes the filter from activeTagFilters.excluded', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'remove' },
        { ...BASE_STATE, excludedTagFilters: ['_docs'] }
      );

      expect(payload.activeTagFilters.excluded).toEqual([]);
      expect(payload.storyCounts).toEqual({});
    });

    it('does not include the removed filter in storyCounts', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'remove' },
        { ...BASE_STATE, includedTagFilters: ['_docs'] }
      );

      expect(payload.storyCounts).toEqual({});
    });
  });

  describe('status filter — include action', () => {
    it('adds the status to activeStatusFilters.included in the payload', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'include' },
        BASE_STATE
      );

      expect(payload.activeStatusFilters.included).toEqual(['status-value:new']);
      expect(payload.activeStatusFilters.excluded).toEqual([]);
    });

    it('includes the story count for the newly included status', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'include' },
        BASE_STATE
      );

      expect(payload.storyCounts).toEqual({ 'status-value:new': 2 });
    });

    it('moves a previously excluded status to included', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'include' },
        { ...BASE_STATE, excludedStatusFilters: ['status-value:new'] }
      );

      expect(payload.activeStatusFilters.included).toEqual(['status-value:new']);
      expect(payload.activeStatusFilters.excluded).toEqual([]);
    });
  });

  describe('status filter — exclude action', () => {
    it('adds the status to activeStatusFilters.excluded in the payload', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'exclude' },
        BASE_STATE
      );

      expect(payload.activeStatusFilters.excluded).toEqual(['status-value:new']);
      expect(payload.activeStatusFilters.included).toEqual([]);
    });

    it('moves a previously included status to excluded', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'exclude' },
        { ...BASE_STATE, includedStatusFilters: ['status-value:new'] }
      );

      expect(payload.activeStatusFilters.included).toEqual([]);
      expect(payload.activeStatusFilters.excluded).toEqual(['status-value:new']);
    });
  });

  describe('status filter — remove action', () => {
    it('removes the status from activeStatusFilters.included', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'remove' },
        { ...BASE_STATE, includedStatusFilters: ['status-value:new', 'status-value:modified'] }
      );

      expect(payload.activeStatusFilters.included).toEqual(['status-value:modified']);
      expect(payload.storyCounts).toEqual({ 'status-value:modified': 4 });
    });

    it('does not include the removed status in storyCounts', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'status', filterId: 'status-value:new', action: 'remove' },
        { ...BASE_STATE, includedStatusFilters: ['status-value:new'] }
      );

      expect(payload.storyCounts).toEqual({});
    });
  });

  describe('payload metadata', () => {
    it('always sets trigger to "interaction"', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'include' },
        BASE_STATE
      );

      expect(payload.trigger).toBe('interaction');
    });

    it('includes the changed descriptor in the payload', () => {
      const changed = { filterType: 'tag' as const, filterId: '_docs', action: 'include' as const };
      const payload = computeFilterTelemetryPayload(changed, BASE_STATE);

      expect(payload.changed).toEqual(changed);
    });

    it('excludes user-defined tags from activeTagFilters even when present in includedTagFilters', () => {
      const payload = computeFilterTelemetryPayload(
        { filterType: 'tag', filterId: '_docs', action: 'include' },
        { ...BASE_STATE, includedTagFilters: ['_docs', 'my-custom-tag'] }
      );

      // my-custom-tag is not a built-in entry so it's filtered out
      expect(payload.activeTagFilters.included).not.toContain('my-custom-tag');
    });
  });
});
