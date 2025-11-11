// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';
import {
  type Status,
  type StatusStoreEvent,
  type StatusesByStoryIdAndTypeId,
  createStatusStore,
} from './index';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from './index';

const story1Type1Status: Status = {
  storyId: 'story-1',
  typeId: 'type-1',
  value: 'status-value:success',
  title: 'Success',
  description: 'Success description',
};

const story1Type2Status: Status = {
  storyId: 'story-1',
  typeId: 'type-2',
  value: 'status-value:error',
  title: 'Error',
  description: 'Error description',
};

const story2Type1Status: Status = {
  storyId: 'story-2',
  typeId: 'type-1',
  value: 'status-value:pending',
  title: 'Pending',
  description: 'Pending description',
};

const story2Type2Status: Status = {
  storyId: 'story-2',
  typeId: 'type-2',
  value: 'status-value:unknown',
  title: 'Unknown',
  description: 'Unknown description',
};

const initialState: StatusesByStoryIdAndTypeId = {
  'story-1': {
    'type-1': story1Type1Status,
    'type-2': story1Type2Status,
  },
  'story-2': {
    'type-1': story2Type1Status,
    'type-2': story2Type2Status,
  },
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
          environment: 'manager',
        });

        // Act - get all statuses
        const result = fullStatusStore.getAll();

        // Assert - all statuses should be returned
        expect(result).toEqual(initialState);
      });
    });

    describe('set', () => {
      it('should add new statuses', () => {
        // Arrange - create a status store
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });

        // Act - set the status
        fullStatusStore.set([story1Type1Status]);
        const result = fullStatusStore.getAll();

        // Assert - the status should be added
        expect(result).toEqual({
          'story-1': {
            'type-1': story1Type1Status,
          },
        });
      });

      it('should update existing statuses with the same storyId and typeId', () => {
        // Arrange - create a status store
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });

        // Create an updated version of the status
        const updatedStatus: Status = {
          ...story1Type1Status,
          value: 'status-value:error',
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - set the initial status, then update it
        fullStatusStore.set([story1Type1Status]);
        fullStatusStore.set([updatedStatus]);
        const result = fullStatusStore.getAll();

        // Assert - the status should be updated
        expect(result).toEqual({
          'story-1': {
            'type-1': updatedStatus,
          },
        });
      });

      it('should update existing statuses and add new ones in a single operation', () => {
        // Arrange - create a status store with initial statuses
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<
            StatusesByStoryIdAndTypeId,
            StatusStoreEvent
          >({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'story-1': {
                'type-1': story1Type1Status,
              },
              'story-2': {
                'type-2': story2Type2Status,
              },
            },
          }),
          environment: 'manager',
        });

        // Create an updated version of an existing status
        const updatedStatus: Status = {
          ...story1Type1Status,
          value: 'status-value:error',
          title: 'Updated Title',
        };

        // Act - update one status and add a new one
        fullStatusStore.set([updatedStatus, story2Type1Status]);
        const result = fullStatusStore.getAll();

        // Assert - the existing status should be updated and the new one added
        expect(result).toEqual({
          'story-1': {
            'type-1': updatedStatus,
          },
          'story-2': {
            'type-1': story2Type1Status,
            'type-2': story2Type2Status,
          },
        });
      });
    });

    describe('onStatusChange', () => {
      it('should call listener when status is added', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });
        const unsubscribe = fullStatusStore.onAllStatusChange(mockSubscriber);

        // Act - set statuses to trigger the subscriber
        fullStatusStore.set([story1Type1Status]);

        // Assert - the subscriber should be called with the statuses and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith(
          { 'story-1': { 'type-1': story1Type1Status } },
          {}
        );
        unsubscribe();
      });

      it('should call listener when status is updated', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<
            StatusesByStoryIdAndTypeId,
            StatusStoreEvent
          >({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'story-1': {
                'type-1': story1Type1Status,
              },
            },
          }),
          environment: 'manager',
        });
        const unsubscribe = fullStatusStore.onAllStatusChange(mockSubscriber);

        // Act - update the existing status
        const updatedStatus = {
          ...story1Type1Status,
          value: 'status-value:error',
          title: 'Updated Title',
        } as const;
        fullStatusStore.set([updatedStatus]);

        // Assert - the subscriber should be called with the updated status and previous status
        expect(mockSubscriber).toHaveBeenCalledWith(
          { 'story-1': { 'type-1': updatedStatus } },
          { 'story-1': { 'type-1': story1Type1Status } }
        );
        unsubscribe();
      });

      it('should call listener when status is unset', () => {
        // Arrange - set up the store and a mock subscriber
        const mockSubscriber = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore<
            StatusesByStoryIdAndTypeId,
            StatusStoreEvent
          >({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState: {
              'story-1': {
                'type-1': story1Type1Status,
              },
            },
          }),
          environment: 'manager',
        });
        const unsubscribe = fullStatusStore.onAllStatusChange(mockSubscriber);

        // Act - unset the status
        fullStatusStore.unset([story1Type1Status.storyId]);

        // Assert - the subscriber should be called with the unset status and previous statuses
        expect(mockSubscriber).toHaveBeenCalledWith(
          {},
          { 'story-1': { 'type-1': story1Type1Status } }
        );
        unsubscribe();
      });
    });

    describe('onSelect', () => {
      it('should call listener when statuses are selected', () => {
        // Arrange - set up the store with initial state and a mock listener
        const mockListener = vi.fn();
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });
        const unsubscribe = fullStatusStore.onSelect(mockListener);

        // Act - select statuses
        const selectedStatuses = [story1Type1Status, story2Type2Status];
        fullStatusStore.selectStatuses(selectedStatuses);

        // Assert - the listener should be called with the selected statuses
        expect(mockListener).toHaveBeenCalledWith(selectedStatuses);

        // Clean up
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
          environment: 'manager',
        });

        // Act - unset without a predicate
        fullStatusStore.unset();
        const result = fullStatusStore.getAll();

        // Assert - all statuses should be removed
        expect(result).toEqual({});
      });

      it('should unset statuses by storyIds', () => {
        // Arrange - set up the store with initial state
        const { fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });

        // Act - unset with a storyIds filter
        fullStatusStore.unset(['story-1']);
        const result = fullStatusStore.getAll();

        // Assert - only statuses with matching storyId should be removed
        expect(result).toEqual({
          'story-2': {
            'type-1': story2Type1Status,
            'type-2': story2Type2Status,
          },
        });
      });
    });
  });

  describe('getStatusStoreByTypeId', () => {
    describe('set', () => {
      it('should add new statuses of the specified typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });

        // Act - get a status store for type-1 and set a status
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.set([story1Type1Status]);

        // Assert - the status should be added to the full store
        const fullResult = fullStatusStore.getAll();
        expect(fullResult).toEqual({
          'story-1': {
            'type-1': story1Type1Status,
          },
        });

        // Assert - the status should be accessible from the type-specific store
        const typeResult = type1StatusStore.getAll();
        expect(typeResult).toEqual({
          'story-1': {
            'type-1': story1Type1Status,
          },
        });
      });

      it('should update existing statuses with the same storyId and typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });

        // Create an updated version of the status
        const updatedStatus: Status = {
          ...story1Type1Status,
          value: 'status-value:error',
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - get a status store for type-1, set the initial status, then update it
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.set([story1Type1Status]);
        type1StatusStore.set([updatedStatus]);
        const result = type1StatusStore.getAll();

        // Assert - the status should be updated
        expect(result).toEqual({
          'story-1': {
            'type-1': updatedStatus,
          },
        });
      });

      it('should update existing statuses and add new ones in a single operation', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });

        // Get the type-specific store
        const type1StatusStore = getStatusStoreByTypeId('type-1');

        // Create an updated version of the existing status
        const updatedStatus: Status = {
          ...story1Type1Status,
          value: 'status-value:error',
          title: 'Updated Title',
          description: 'Updated Description',
        };

        // Act - update existing status and add a new one in the same operation
        type1StatusStore.set([updatedStatus, story2Type1Status]);

        // Assert - all statuses should be in the full store
        const result = type1StatusStore.getAll();
        expect(result).toEqual({
          'story-1': {
            'type-1': updatedStatus,
            'type-2': story1Type2Status,
          },
          'story-2': {
            'type-1': story2Type1Status,
            'type-2': story2Type2Status,
          },
        });
      });

      it('should error when setting statuses with wrong typeId', () => {
        // Arrange - create a status store
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
          environment: 'manager',
        });

        // Act & Assert - get a status store for type-1 and try to set a status with type-2, expect it to throw
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        expect(() => type1StatusStore.set([story1Type2Status])).toThrowErrorMatchingInlineSnapshot(`
          [SB_MANAGER_API_0001 (StatusTypeIdMismatchError): Status has typeId "type-2" but was added to store with typeId "type-1". Full status: {
            "storyId": "story-1",
            "typeId": "type-2",
            "value": "status-value:error",
            "title": "Error",
            "description": "Error description"
          }]
        `);
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
          environment: 'manager',
        });

        // Act - get a status store for type-1 and unset without a predicate
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.unset();

        // Assert - statuses with other typeIds should remain
        const fullResult = fullStatusStore.getAll();
        expect(fullResult).toEqual({
          'story-1': {
            'type-2': story1Type2Status,
          },
          'story-2': {
            'type-2': story2Type2Status,
          },
        });
      });

      it('should unset statuses by storyIds', () => {
        // Arrange - set up the store with initial state
        const { getStatusStoreByTypeId } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });

        // Act - get a status store for type-1 and unset with a storyIds filter
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        type1StatusStore.unset(['story-1']);
        const result = type1StatusStore.getAll();

        // Assert - only statuses with typeId 'type-1' and storyId 'story-1' should be removed
        expect(result).toEqual({
          'story-1': { 'type-2': story1Type2Status },
          'story-2': { 'type-1': story2Type1Status, 'type-2': story2Type2Status },
        });
      });
    });

    describe('onSelect', () => {
      it('should call listener when statuses of the specified typeId are selected', () => {
        // Arrange - set up the store with initial state and a mock listener
        const mockListener = vi.fn();
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });

        // Get a type-specific store and subscribe to selections
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onSelect(mockListener);

        // Act - select statuses including one with the matching typeId
        const selectedStatuses = [story1Type1Status, story2Type2Status];
        fullStatusStore.selectStatuses(selectedStatuses);

        // Assert - the listener should be called with the selected statuses
        expect(mockListener).toHaveBeenCalledWith(selectedStatuses);

        // Clean up
        unsubscribe();
      });

      it('should not call listener when selected statuses do not include the specified typeId', () => {
        // Arrange - set up the store with initial state and a mock listener
        const mockListener = vi.fn();
        const { getStatusStoreByTypeId, fullStatusStore } = createStatusStore({
          universalStatusStore: new MockUniversalStore({
            ...UNIVERSAL_STATUS_STORE_OPTIONS,
            initialState,
          }),
          environment: 'manager',
        });

        // Get a type-specific store and subscribe to selections
        const type1StatusStore = getStatusStoreByTypeId('type-1');
        const unsubscribe = type1StatusStore.onSelect(mockListener);

        // Act - select statuses without any matching typeId
        const selectedStatuses = [story1Type2Status, story2Type2Status];
        fullStatusStore.selectStatuses(selectedStatuses);

        // Assert - the listener should not be called
        expect(mockListener).not.toHaveBeenCalled();

        // Clean up
        unsubscribe();
      });
    });
  });

  describe('useStatusStore', () => {
    it('should be returned when useUniversalStore is provided', () => {
      // Act - create a status store with the mock
      const { useStatusStore } = createStatusStore({
        universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        useUniversalStore,
        environment: 'manager',
      });

      // Assert - useStatusStore should be defined
      expect(useStatusStore).toBeDefined();
    });

    it('should return all statuses when no selector is provided', () => {
      // Arrange - create a status store
      const { useStatusStore } = createStatusStore({
        universalStatusStore: new MockUniversalStore({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
        environment: 'manager',
      });

      // Act - get a status store for type-1 and render the hook
      const { result } = renderHook(() => useStatusStore());

      // Assert - initial statuses should be returned
      expect(result.current).toEqual(initialState);
    });

    it('should filter statuses based on selector', () => {
      // Arrange - create a status store
      const { useStatusStore } = createStatusStore({
        universalStatusStore: new MockUniversalStore({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
        environment: 'manager',
      });

      // Create a selector that only returns SUCCESS statuses
      const successSelector = (statuses: StatusesByStoryIdAndTypeId) => {
        const result: StatusesByStoryIdAndTypeId = {};

        Object.entries(statuses).forEach(([storyId, typeStatuses]) => {
          Object.entries(typeStatuses).forEach(([typeId, status]) => {
            if (status.value === 'status-value:success') {
              if (!result[storyId]) {
                result[storyId] = {};
              }
              result[storyId][typeId] = status;
            }
          });
        });

        return result;
      };

      // Act - render the hook with the selector
      const { result } = renderHook(() => useStatusStore(successSelector));

      // Assert - only SUCCESS statuses should be returned
      expect(result.current).toEqual({
        'story-1': {
          'type-1': story1Type1Status,
        },
      });
    });

    it('should re-render when statuses matching the selector change', async () => {
      // Arrange - create a status store
      const { useStatusStore, fullStatusStore } = createStatusStore({
        universalStatusStore: new MockUniversalStore({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
        environment: 'manager',
      });
      const renderCounter = vi.fn();

      // Create a selector that only returns statuses for story-1
      const story1Selector = (statuses: StatusesByStoryIdAndTypeId) => statuses['story-1'] || {};

      // Act - render the hook with the selector
      const { result } = renderHook(() => {
        renderCounter();
        return useStatusStore(story1Selector);
      });

      // Assert - initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual({
        'type-1': story1Type1Status,
        'type-2': story1Type2Status,
      });

      // Act - update a status for story-1
      const updatedStory1Type1Status = {
        ...story1Type1Status,
        value: 'status-value:error',
        title: 'Updated Error',
        description: 'Updated error description',
      } as const;

      act(() => {
        fullStatusStore.set([updatedStory1Type1Status]);
      });

      // Assert - the hook should re-render with the updated status
      expect(renderCounter).toHaveBeenCalledTimes(2);
      expect(result.current).toEqual({
        'type-1': updatedStory1Type1Status,
        'type-2': story1Type2Status,
      });
    });

    it('should not re-render when statuses not matching the selector change', async () => {
      // Arrange - create a status store
      const { useStatusStore, fullStatusStore } = createStatusStore({
        universalStatusStore: new MockUniversalStore({
          ...UNIVERSAL_STATUS_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
        environment: 'manager',
      });
      const renderCounter = vi.fn();

      // Create a selector that only returns statuses for story-1
      const story1Selector = (statuses: StatusesByStoryIdAndTypeId) => statuses['story-1'] || {};

      // Act - render the hook with the selector
      const { result } = renderHook(() => {
        renderCounter();
        return useStatusStore(story1Selector);
      });

      // Assert - initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual({
        'type-1': story1Type1Status,
        'type-2': story1Type2Status,
      });

      // Act - update a status for story-2 (which doesn't match the selector)
      const updatedStory2Type1Status = {
        ...story2Type1Status,
        value: 'status-value:error',
        title: 'Updated Error',
        description: 'Updated error description',
      } as const;

      act(() => {
        fullStatusStore.set([updatedStory2Type1Status]);
      });

      // Assert - the hook should not re-render since the change doesn't affect the selected data
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual({
        'type-1': story1Type1Status,
        'type-2': story1Type2Status,
      });
    });
  });
});
