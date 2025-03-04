// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';
import {
  type Status,
  type StatusTypeId,
  StatusValue,
  type StoreState,
  createStatusStore,
} from './index';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from './index';

const story1Type1Status: Status<'type-1'> = {
  storyId: 'story-1',
  typeId: 'type-1',
  value: StatusValue.SUCCESS,
  title: 'Success',
  description: 'Success description',
};

const story1Type2Status: Status<'type-2'> = {
  storyId: 'story-1',
  typeId: 'type-2',
  value: StatusValue.ERROR,
  title: 'Error',
  description: 'Error description',
};

const story2Type1Status: Status<'type-1'> = {
  storyId: 'story-2',
  typeId: 'type-1',
  value: StatusValue.PENDING,
  title: 'Pending',
  description: 'Pending description',
};

const story2Type2Status: Status<'type-2'> = {
  storyId: 'story-2',
  typeId: 'type-2',
  value: StatusValue.UNKNOWN,
  title: 'Unknown',
  description: 'Unknown description',
};

const initialState: StoreState = {
  'type-1': [story1Type1Status, story2Type1Status],
  'type-2': [story1Type2Status, story2Type2Status],
};

describe('statusStore', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fullStatusStore', () => {
    describe('get', () => {
      it('should return all statuses', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get all statuses
        const result = fullStatusStore.get();

        // Assert - all statuses should be returned
        expect(result).toHaveLength(4);
        expect(result).toEqual(
          expect.arrayContaining([
            story1Type1Status,
            story1Type2Status,
            story2Type1Status,
            story2Type2Status,
          ])
        );
      });
    });

    describe('set', () => {
      it('should add new statuses', () => {
        // Arrange - create a status store
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Act - set the status
        fullStatusStore.set([story1Type1Status]);
        const result = fullStatusStore.get();

        // Assert - the status should be added
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(story1Type1Status);
      });

      it('should update existing statuses with the same storyId and typeId', () => {
        // Arrange - create a status store
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Create an updated version of the status
        const updatedStatus: Status<'type-1'> = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - set the initial status, then update it
        fullStatusStore.set([story1Type1Status]);
        fullStatusStore.set([updatedStatus]);
        const result = fullStatusStore.get();

        // Assert - the status should be updated
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(updatedStatus);
      });

      it('should update existing statuses and add new ones in a single operation', () => {
        // Arrange - create a status store with initial statuses
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<StoreState>({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'type-1': [story1Type1Status],
              'type-2': [story2Type2Status],
            },
          }),
        });

        // Create an updated version of an existing status
        const updatedStatus: Status<'type-1'> = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Title',
        };

        // Act - update one status and add a new one
        fullStatusStore.set([updatedStatus, story2Type1Status]);
        const result = fullStatusStore.get();

        // Assert - the existing status should be updated and the new one added
        expect(result).toHaveLength(3);
        expect(result).toEqual(
          expect.arrayContaining([updatedStatus, story2Type1Status, story2Type2Status])
        );
      });
    });

    describe('onStatusChange', () => {
      it('should call listener when status is added', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });
        const unsubscribe = fullStatusStore.onStatusChange(mockSubscriber);

        // Act - set statuses to trigger the subscriber
        fullStatusStore.set([story1Type1Status]);

        // Assert - the subscriber should be called with the statuses and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith([story1Type1Status], []);
        unsubscribe();
      });

      it('should call listener when status is updated', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<StoreState>({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'type-1': [story1Type1Status],
            },
          }),
        });
        const unsubscribe = fullStatusStore.onStatusChange(mockSubscriber);

        // Act - update the existing status
        const updatedStatus = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Title',
        };
        fullStatusStore.set([updatedStatus]);

        // Assert - the subscriber should be called with the updated status and previous status
        expect(mockSubscriber).toHaveBeenCalledWith([updatedStatus], [story1Type1Status]);
        unsubscribe();
      });

      it('should call listener when status is unset', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<StoreState>({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'type-1': [story1Type1Status],
            },
          }),
        });
        const unsubscribe = fullStatusStore.onStatusChange(mockSubscriber);

        // Act - unset the status
        fullStatusStore.unset([story1Type1Status.typeId]);

        // Assert - the subscriber should be called with the unset status and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith([], [story1Type1Status]);
        unsubscribe();
      });
    });

    describe('unset', () => {
      it('should unset all statuses when typeIds and storyIds are not provided', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - unset without a predicate
        fullStatusStore.unset();
        const result = fullStatusStore.get();

        // Assert - all statuses should be removed
        expect(result).toHaveLength(0);
      });

      it('should unset statuses by typeIds', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - unset with a typeIds filter
        fullStatusStore.unset(['type-1']);
        const result = fullStatusStore.get();

        // Assert - only statuses with matching typeId should be removed
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([story1Type2Status, story2Type2Status]));
      });

      it('should unset statuses by storyIds', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - unset with a storyIds filter
        fullStatusStore.unset(undefined, ['story-1']);
        const result = fullStatusStore.get();

        // Assert - only statuses with matching storyId should be removed
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([story2Type1Status, story2Type2Status]));
      });

      it('should unset statuses by both typeIds and storyIds', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - unset with both typeIds and storyIds filters
        fullStatusStore.unset(['type-1', 'type-2'], ['story-1']);
        const result = fullStatusStore.get();

        // Assert - only statuses with matching typeId AND storyId should be removed
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([story2Type1Status, story2Type2Status]));
      });
    });

    describe('useStatusStore', () => {
      it('should be returned when useUniversalStore is provided', () => {
        // Act - create a status store with the mock
        const { useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          useUniversalStore,
        });

        // Assert - useStatusStore should be defined
        expect(useStatusStore).toBeDefined();
      });

      it('should return all statuses when no selector is provided', () => {
        // Arrange - create a status store
        const { fullStatusStore, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });

        // Act - get a status store for type-1 and render the hook
        const { result } = renderHook(() => useStatusStore(fullStatusStore));

        // Assert - initial statuses should be returned
        expect(result.current).toEqual([
          story1Type1Status,
          story2Type1Status,
          story1Type2Status,
          story2Type2Status,
        ]);
      });

      it('should filter statuses based on selector', () => {
        // Arrange - create a status store
        const { fullStatusStore, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });

        // Create a selector that only returns SUCCESS statuses
        const successSelector = (statuses: Status<StatusTypeId>[]) =>
          statuses.filter((status) => status.storyId === 'story-1');

        // Act - get a status store for type-1 and render the hook with the selector
        const { result } = renderHook(() => useStatusStore(fullStatusStore, successSelector));

        // Assert - only SUCCESS statuses should be returned
        expect(result.current).toHaveLength(2);
        expect(result.current).toEqual(
          expect.arrayContaining([story1Type1Status, story1Type2Status])
        );
      });

      it('should re-render when statuses matching the selector change', async () => {
        // Arrange - create a status store
        const { useStatusStore, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });
        const renderCounter = vi.fn();

        // Create a selector that only returns statuses for story-1
        const story1Selector = (statuses: Status<StatusTypeId>[]) =>
          statuses.filter((status) => status.storyId === 'story-1');

        // Act - render the hook with the selector
        const { result } = renderHook(() => {
          renderCounter();
          return useStatusStore(fullStatusStore, story1Selector);
        });

        // Assert - initial render
        expect(renderCounter).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual(
          expect.arrayContaining([story1Type1Status, story1Type2Status])
        );

        // Act - update a status for story-1
        const updatedStory1Type1Status = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Error',
          description: 'Updated error description',
        };

        act(() => {
          fullStatusStore.set([updatedStory1Type1Status]);
        });

        // Assert - the hook should re-render with the updated status
        expect(renderCounter).toHaveBeenCalledTimes(2);
        expect(result.current).toHaveLength(2);
        expect(result.current).toEqual(
          expect.arrayContaining([updatedStory1Type1Status, story1Type2Status])
        );
      });
    });
  });

  describe('getStatusStoreByTypeId', () => {
    it('should return a status store that only has access to statuses with the specified typeId', () => {
      // Arrange - set up the store with initial state
      const { getStatusStoreByTypeId } = createStatusStore({
        universalStatusStore: new MockUniversalStore({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          initialState,
        }),
      });

      // Act - get a status store for type-1
      const type1StatusStore = getStatusStoreByTypeId('type-1');
      const result = type1StatusStore.get();

      // Assert - only statuses with typeId 'type-1' should be returned
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([story1Type1Status, story2Type1Status]));
    });

    describe('get', () => {
      it('should return all statuses of the specified typeId', () => {
        // Arrange - set up the store with initial state
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get a status store for type-1 and get all statuses
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const result = type1StatusStore.get();

        // Assert - all statuses with typeId 'type-1' should be returned
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([story1Type1Status, story2Type1Status]));
      });
    });

    describe('set', () => {
      it('should add new statuses of the specified typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Act - get a status store for type-1 and set a status
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.set([story1Type1Status]);

        // Assert - the status should be added to the full store
        const fullResult = fullStatusStore.get();
        expect(fullResult).toHaveLength(1);
        expect(fullResult[0]).toEqual(story1Type1Status);

        // Assert - the status should be accessible from the type-specific store
        const typeResult = type1StatusStore.get();
        expect(typeResult).toHaveLength(1);
        expect(typeResult[0]).toEqual(story1Type1Status);
      });

      it('should update existing statuses with the same storyId and typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Create an updated version of the status
        const updatedStatus: Status<'type-1'> = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - get a status store for type-1, set the initial status, then update it
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.set([story1Type1Status]);
        type1StatusStore.set([updatedStatus]);
        const result = type1StatusStore.get();

        // Assert - the status should be updated
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(updatedStatus);
      });

      it('should update existing statuses and add new ones in a single operation', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Get the type-specific store
        const type1StatusStore = getStatusStoreByTypeId('type-1');

        // Create an updated version of the existing status
        const updatedStatus: Status<'type-1'> = {
          ...story1Type1Status,
          value: StatusValue.ERROR,
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - update existing status and add a new one in the same operation
        type1StatusStore.set([updatedStatus, story2Type1Status]);

        // Assert - all statuses should be in the full store
        const fullResult = fullStatusStore.get();
        expect(fullResult).toHaveLength(4);
        expect(fullResult).toEqual(expect.arrayContaining([updatedStatus, story2Type1Status]));

        // Assert - both statuses should be accessible from the type-specific store
        const typeResult = type1StatusStore.get();
        expect(typeResult).toHaveLength(2);
        expect(typeResult).toEqual(expect.arrayContaining([updatedStatus, story2Type1Status]));
      });

      it('should error when setting statuses with wrong typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Act & Assert - get a status store for type-1 and try to set a status with type-2, expect it to throw
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        expect(() => type1StatusStore.set([story1Type2Status])).toThrowErrorMatchingInlineSnapshot(
          `
          [Error: Status typeId mismatch: Status has typeId "type-2" but was added to store with typeId "type-1". Full status: {
            "storyId": "story-1",
            "typeId": "type-2",
            "value": "error",
            "title": "Error",
            "description": "Error description"
          }]
        `
        );
      });
    });

    describe('onStatusChange', () => {
      it('should call listener when statuses of the specified typeId change', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Act - get a status store for type-1 and subscribe to changes
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onStatusChange(mockSubscriber);

        // Act - set a status with the matching typeId
        type1StatusStore.set([story1Type1Status]);

        // Assert - the subscriber should be called with the statuses and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith([story1Type1Status], []);
        unsubscribe();
      });

      it('should not call listener when statuses of different typeId change', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        });

        // Act - get a status store for type-1 and subscribe to changes
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onStatusChange(mockSubscriber);

        // Act - set a status with a different typeId
        fullStatusStore.set([story1Type2Status]);

        // Assert - the subscriber should not be called
        expect(mockSubscriber).not.toHaveBeenCalled();
        unsubscribe();
      });

      it('should call listener when a status is unset', () => {
        // Arrange - set up the store with initial state
        const mockSubscriber = vi.fn();
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get a status store for type-1 and subscribe to changes
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onStatusChange(mockSubscriber);

        // Act - unset a specific story status
        type1StatusStore.unset(['story-1']);

        // Assert - the subscriber should be called with the updated statuses and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith(
          [story2Type1Status], // Only story2Type1Status remains
          [story1Type1Status, story2Type1Status] // Previous state had both
        );
        unsubscribe();
      });

      it('should call listener when all statuses of the typeId are unset', () => {
        // Arrange - set up the store with initial state
        const mockSubscriber = vi.fn();
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get a status store for type-1 and subscribe to changes
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onStatusChange(mockSubscriber);

        // Act - unset all statuses for this typeId
        type1StatusStore.unset();

        // Assert - the subscriber should be called with empty array and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith(
          [], // No statuses remain
          [story1Type1Status, story2Type1Status] // Previous state had both
        );
        unsubscribe();
      });
    });

    describe('unset', () => {
      it('should unset all statuses of the specified typeId when no storyIds are provided', () => {
        // Arrange - set up the store with initial state
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get a status store for type-1 and unset without a predicate
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.unset();

        // Assert - all statuses with typeId 'type-1' should be removed
        const typeResult = type1StatusStore.get();
        expect(typeResult).toHaveLength(0);

        // Assert - statuses with other typeIds should remain
        const fullResult = fullStatusStore.get();
        expect(fullResult).toHaveLength(2);
        expect(fullResult).toEqual(expect.arrayContaining([story1Type2Status, story2Type2Status]));
      });

      it('should unset statuses by storyIds', () => {
        // Arrange - set up the store with initial state
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get a status store for type-1 and unset with a storyIds filter
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.unset(['story-1']);
        const result = type1StatusStore.get();

        // Assert - only statuses with typeId 'type-1' and storyId 'story-1' should be removed
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(story2Type1Status);
      });
    });

    describe('useStatusStore', () => {
      it('should return initial statuses for the specified typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });

        // Act - get a status store for type-1 and render the hook
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const { result } = renderHook(() => useStatusStore(type1StatusStore));

        // Assert - initial statuses should be returned
        expect(result.current).toEqual([story1Type1Status, story2Type1Status]);
      });

      it('should filter statuses based on selector', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });

        // Create a selector that only returns SUCCESS statuses
        const successSelector = (statuses: Status<StatusTypeId>[]) =>
          statuses.filter((status) => status.value === StatusValue.SUCCESS);

        // Act - get a status store for type-1 and render the hook with the selector
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const { result } = renderHook(() => useStatusStore(type1StatusStore, successSelector));

        // Assert - only SUCCESS statuses should be returned
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual(story1Type1Status);
      });

      it('should re-render when statuses of the specified typeId change', async () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });
        const renderCounter = vi.fn();

        // Act - get a status store for type-1 and render the hook
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const { result } = renderHook(() => {
          renderCounter();
          return useStatusStore(type1StatusStore);
        });

        // Assert - initial render
        expect(renderCounter).toHaveBeenCalledTimes(1);
        const initialStatuses = result.current;
        expect(initialStatuses).toEqual([story1Type1Status, story2Type1Status]);

        // Act - set a status with the matching typeId
        // Create a new status for story-3
        const story3Type1Status = {
          typeId: 'type-1',
          storyId: 'story-3',
          value: StatusValue.SUCCESS,
          title: 'Story 3 Type 1 Status',
          description: 'Description for Story 3 Type 1 Status',
        };

        act(() => {
          type1StatusStore.set([story3Type1Status]);
        });

        // Assert - the hook should re-render with the new status
        expect(renderCounter).toHaveBeenCalledTimes(2);
        const updatedStatuses = result.current;
        expect(updatedStatuses).toHaveLength(3);
        expect(updatedStatuses).toEqual([story1Type1Status, story2Type1Status, story3Type1Status]);
      });

      it('should only re-render when statuses matching the selector change', async () => {
        // Arrange - create a status store with initial state
        const { getStatusStoreByTypeId, useStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          useUniversalStore,
        });
        const renderCounter = vi.fn();

        // Create a selector that only returns ERROR statuses
        const errorSelector = (statuses: Status<StatusTypeId>[]) =>
          statuses.filter((status) => status.value === StatusValue.ERROR);

        // Act - get a status store for type-1 and render the hook with the selector
        const type1StatusStore = getStatusStoreByTypeId('type-2');
        const { result } = renderHook(() => {
          renderCounter();
          return useStatusStore(type1StatusStore, errorSelector);
        });

        // Assert - initial render should only have error statuses
        expect(renderCounter).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual([story1Type2Status]); // Only story1 has ERROR status

        // Act - set a status with SUCCESS value (should not trigger re-render)
        const story3SuccessStatus = {
          typeId: 'type-2',
          storyId: 'story-3',
          value: StatusValue.SUCCESS,
          title: 'Story 3 Type 2 Status',
          description: 'Description for Story 3 Type 2 Status',
        };

        act(() => {
          type1StatusStore.set([story3SuccessStatus]);
        });

        // Assert - the hook should NOT re-render since the new status doesn't match the selector
        expect(renderCounter).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual([story1Type2Status]); // Still only story2

        // Act - set a status with ERROR value (should trigger re-render)
        const story3ErrorStatus = {
          typeId: 'type-2',
          storyId: 'story-3',
          value: StatusValue.ERROR,
          title: 'Story 3 Type 2 Error Status',
          description: 'Description for Story 3 Type 2 Error Status',
        };

        act(() => {
          type1StatusStore.set([story3ErrorStatus]);
        });

        // Assert - the hook should re-render with the new error status
        expect(renderCounter).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual([story1Type2Status, story3ErrorStatus]);
      });
    });
  });
});
