import { describe, expectTypeOf, it } from 'vitest';

import {
  type Status,
  type StatusesByStoryIdAndTypeId,
  UNIVERSAL_STATUS_STORE_OPTIONS,
  createStatusStore,
} from '.';
import type { StoryId } from '../../types';
import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';

const { fullStatusStore, getStatusStoreByTypeId, useStatusStore } = createStatusStore({
  universalStatusStore: MockUniversalStore.create(UNIVERSAL_STATUS_STORE_OPTIONS),
  useUniversalStore,
  environment: 'manager',
});
const typedStatusStore = getStatusStoreByTypeId('test');

describe('Status Store', () => {
  it('getAll should return typed statuses', () => {
    const statuses = fullStatusStore.getAll();
    expectTypeOf(statuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();

    const typedStatuses = typedStatusStore.getAll();
    expectTypeOf(typedStatuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
  });

  it('set should accept typed statuses', () => {
    expectTypeOf(fullStatusStore.set).parameter(0).toEqualTypeOf<Status[]>();
    expectTypeOf(typedStatusStore.set).parameter(0).toEqualTypeOf<Status[]>();
  });

  it('unset should accept storyIds or no parameters', () => {
    expectTypeOf(fullStatusStore.unset).parameter(0).toEqualTypeOf<StoryId[] | undefined>();
    expectTypeOf(typedStatusStore.unset).parameter(0).toEqualTypeOf<StoryId[] | undefined>();
  });

  it('onStatusChange should accept a callback with typed parameters', () => {
    fullStatusStore.onAllStatusChange((statuses, previousStatuses) => {
      expectTypeOf(statuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
      expectTypeOf(previousStatuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
    });
    typedStatusStore.onAllStatusChange((statuses, previousStatuses) => {
      expectTypeOf(statuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
      expectTypeOf(previousStatuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
    });
  });

  it('onSelect should accept a callback with typed parameters', () => {
    fullStatusStore.onSelect((statuses) => {
      expectTypeOf(statuses).toEqualTypeOf<Status[]>();
    });
    typedStatusStore.onSelect((statuses) => {
      expectTypeOf(statuses).toEqualTypeOf<Status[]>();
    });
  });

  it('useStatusStore should return typed statuses', () => {
    // Without selector
    const allStatuses = useStatusStore();
    expectTypeOf(allStatuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();

    // With selector
    const selectedState = useStatusStore((statuses) => {
      expectTypeOf(statuses).toEqualTypeOf<StatusesByStoryIdAndTypeId>();
      return 1;
    });
    expectTypeOf(selectedState).toEqualTypeOf<number>();
  });
});
