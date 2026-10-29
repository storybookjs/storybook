import type { ChannelLike } from '../../channels/types.ts';
import { StorybookInstanceUnavailableError } from '../../server-errors.ts';
import type { InstanceContext } from '../../shared/instance-context.ts';
import { getInstanceContext } from '../../shared/instance-context.ts';
import {
  createStatusStore,
  type StatusesByStoryIdAndTypeId,
  type StatusStoreEvent,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import {
  createTestProviderStore,
  type TestProviderStateByProviderId,
  type TestProviderStoreEvent,
  UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
} from '../../shared/test-provider-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

/** The status and test-provider stores of one Storybook instance, or of one client of it. */
export interface CoreStores {
  /** `storybook/status`: statuses by story id and status type id. */
  status: ReturnType<typeof createServerStatusStore>;
  /** `storybook/test-provider`: the state of each test provider. */
  testProvider: ReturnType<typeof createServerTestProviderStore>;
  /** Stop syncing both stores. */
  dispose(): void;
}

const CORE_STORES = Symbol('storybook.instance.core-stores');
const INTROSPECTED_KEYS = new Set<string>(['__esModule', 'then']);

/** Creates the core stores on `channel`, as their owner or as a client of the owner. */
export function createCoreStores({
  channel,
  owner,
}: {
  channel: ChannelLike;
  owner: boolean;
}): CoreStores {
  const status = createServerStatusStore(channel, owner);
  const testProvider = createServerTestProviderStore(channel, owner);
  return {
    status,
    testProvider,
    dispose() {
      status.universalStatusStore.__dispose();
      testProvider.universalTestProviderStore.__dispose();
    },
  };
}

/**
 * Creates the instance's core stores and disposes them on close. An instance owns them unless it is
 * attached to a dev server, which then owns them.
 */
export function setupCoreStores(
  context: InstanceContext,
  { owner }: { owner: boolean }
): CoreStores {
  if (!context.channel) {
    throw new StorybookInstanceUnavailableError({ reason: 'outside-instance', api: 'core stores' });
  }
  const stores = createCoreStores({ channel: context.channel, owner });
  context.state.set(CORE_STORES, stores);
  context.cleanups.add(() => stores.dispose());
  return stores;
}

/** The current instance's core stores; a bare test context gets owned ones on first use. */
export function getCoreStores(): CoreStores {
  const context = getInstanceContext();
  if (!context) {
    throw new StorybookInstanceUnavailableError({ reason: 'outside-instance', api: 'core stores' });
  }
  return (
    (context.state.get(CORE_STORES) as CoreStores | undefined) ??
    setupCoreStores(context, { owner: !context.storybook?.attached })
  );
}

/** A stable object that forwards to the current instance's value, for module-level exports. */
export function forwardToInstance<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(empty, prop) {
      // Introspection (module mocking, interop, thenable checks) must not require an instance.
      if (typeof prop === 'symbol' || INTROSPECTED_KEYS.has(prop)) {
        return Reflect.get(empty, prop);
      }
      const target = get();
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function createServerStatusStore(channel: ChannelLike, owner: boolean) {
  return createStatusStore({
    universalStatusStore: UniversalStore.create<StatusesByStoryIdAndTypeId, StatusStoreEvent>({
      ...UNIVERSAL_STATUS_STORE_OPTIONS,
      owner,
      channel,
    }),
    environment: 'server',
  });
}

function createServerTestProviderStore(channel: ChannelLike, owner: boolean) {
  return createTestProviderStore({
    universalTestProviderStore: UniversalStore.create<
      TestProviderStateByProviderId,
      TestProviderStoreEvent
    >({
      ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
      owner,
      channel,
    }),
  });
}
