import { isEqual } from 'es-toolkit';
import { dedent } from 'ts-dedent';

import { instances } from './instances';
import type {
  Actor,
  ChannelEvent,
  ChannelLike,
  EnvironmentOverrides,
  EnvironmentType,
  Event,
  EventInfo,
  ExistingStateResponseEvent,
  Listener,
  SetStateEvent,
  StateUpdater,
  StatusType,
  StoreOptions,
} from './types';

const CHANNEL_EVENT_PREFIX = 'UNIVERSAL_STORE:' as const;

const ProgressState = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;

/**
 * A universal store implementation that synchronizes state across different environments using a
 * channel-based communication.
 *
 * The store follows a leader-follower pattern where:
 *
 * - Leader: The main store instance that owns and manages the state
 * - Follower: Store instances that mirror the leader's state
 *
 * Features:
 *
 * - State synchronization across environments
 * - Event-based communication
 * - Type-safe state and custom events
 * - Subscription system for state changes and custom events
 *
 * @remarks
 * - The store must be created using the static `create()` method, not the constructor
 * - Follower stores will automatically sync with their leader's state. If they have initial state, it
 *   will be replaced immediately when it has synced with the leader.
 *
 * @example
 *
 * ```typescript
 * interface MyState {
 *   count: number;
 * }
 * interface MyCustomEvent {
 *   type: 'INCREMENT';
 *   payload: number;
 * }
 *
 * // Create a leader store
 * const leaderStore = UniversalStore.create<MyState, MyCustomEvent>({
 *   id: 'my-store',
 *   leader: true,
 *   initialState: { count: 0 },
 * });
 *
 * // Create a follower store
 * const followerStore = UniversalStore.create<MyState, MyCustomEvent>({
 *   id: 'my-store',
 *   leader: false,
 * });
 * ```
 *
 * @template State - The type of state managed by the store
 * @template CustomEvent - Custom events that can be sent through the store. Must have a `type`
 *   string and optional `payload`
 * @throws {Error} If constructed directly instead of using `create()`
 * @throws {Error} If created without setting a channel first
 * @throws {Error} If a follower is created with initial state
 * @throws {Error} If a follower cannot find its leader within 1 second
 */
export class UniversalStore<
  State,
  CustomEvent extends { type: string; payload?: any } = { type: string; payload?: any },
> {
  /**
   * Defines the possible actor types in the store system
   *
   * @readonly
   */
  public static readonly ActorType = {
    LEADER: 'LEADER',
    FOLLOWER: 'FOLLOWER',
  } as const;

  /**
   * Defines the possible environments the store can run in
   *
   * @readonly
   */
  public static readonly Environment = {
    SERVER: 'SERVER',
    MANAGER: 'MANAGER',
    PREVIEW: 'PREVIEW',
    UNKNOWN: 'UNKNOWN',
    MOCK: 'MOCK',
  } as const;

  /**
   * Internal event types used for store synchronization
   *
   * @readonly
   */
  public static readonly InternalEventType = {
    EXISTING_STATE_REQUEST: '__EXISTING_STATE_REQUEST',
    EXISTING_STATE_RESPONSE: '__EXISTING_STATE_RESPONSE',
    SET_STATE: '__SET_STATE',
    LEADER_CREATED: '__LEADER_CREATED',
    FOLLOWER_CREATED: '__FOLLOWER_CREATED',
  } as const;

  public static readonly Status = {
    UNPREPARED: 'UNPREPARED',
    SYNCING: 'SYNCING',
    READY: 'READY',
    ERROR: 'ERROR',
  } as const;

  // This is used to check if constructor was called from the static factory create()
  protected static isInternalConstructing = false;

  static {
    UniversalStore.setupPreparationPromise();
  }

  /**
   * The preparation construct is used to keep track of all store's preparation state the promise is
   * resolved when the store is prepared with the static __prepare() method which will also change
   * the state from PENDING to RESOLVED
   */
  private static preparation: {
    channel?: ChannelLike;
    environment?: EnvironmentType;
    resolve: (args: Awaited<typeof UniversalStore.preparation.promise>) => void;
    reject: (error: Error) => void;
    promise: Promise<{ channel: ChannelLike; environment: EnvironmentType }>;
  };

  private static setupPreparationPromise() {
    let resolveRef: typeof UniversalStore.preparation.resolve;
    let rejectRef: typeof UniversalStore.preparation.reject;

    const promise = new Promise<Awaited<typeof UniversalStore.preparation.promise>>(
      (resolve, reject) => {
        resolveRef = (args) => {
          resolve(args);
        };
        rejectRef = (...args) => {
          reject(args);
        };
      }
    );

    UniversalStore.preparation = {
      resolve: resolveRef!,
      reject: rejectRef!,
      promise,
    };
  }

  /** Enable debug logs for this store */
  public debugging = false;

  /** The actor object representing the store instance with a unique ID and a type */
  public get actor(): Actor {
    return Object.freeze({
      id: this.actorId,
      type: this.actorType,
      environment: this.environment ?? UniversalStore.Environment.UNKNOWN,
    });
  }

  /**
   * The current state of the store, that signals both if the store is prepared by Storybook and
   * also - in the case of a follower - if the state has been synced with the leader's state.
   */
  public get status(): StatusType {
    if (!this.channel || !this.environment) {
      return UniversalStore.Status.UNPREPARED;
    }

    switch (this.syncing?.state) {
      case ProgressState.PENDING:
      case undefined:
        return UniversalStore.Status.SYNCING;

      case ProgressState.REJECTED:
        return UniversalStore.Status.ERROR;
      case ProgressState.RESOLVED:
      default:
        return UniversalStore.Status.READY;
    }
  }

  /**
   * A promise that resolves when the store is fully ready. A leader will be ready when the store
   * has been prepared by Storybook, which is almost instantly.
   *
   * A follower will be ready when the state has been synced with the leader's state, within a few
   * hundred milliseconds.
   */
  public untilReady() {
    return Promise.all([UniversalStore.preparation.promise, this.syncing?.promise]);
  }

  /**
   * The syncing construct is used to keep track of if the instance's state has been synced with the
   * other instances. A leader will immediately have the promise resolved. A follower will initially
   * be in a PENDING state, and resolve the the leader has sent the existing state, or reject if no
   * leader has responded before the timeout.
   */
  private syncing?: {
    state: (typeof ProgressState)[keyof typeof ProgressState];
    promise?: Promise<void>;
    resolve?: () => void;
    reject?: (error: Error) => void;
  };

  private channelEventName: string;

  private state: State;

  // Unless overridden with the environmentOverrides constructor parameter, this will be the same as the static channel
  private channel?: ChannelLike;

  // Unless overridden with the environmentOverrides constructor parameter, this will be the same as the static environment
  private environment?: EnvironmentType;

  // TODO: narrow type of listeners based on event type
  private listeners: Map<string, Set<Listener<any>>> = new Map([['*', new Set()]]);

  private id: string;

  private actorId: Actor['id'];

  private actorType: Actor['type'];

  protected constructor(options: StoreOptions<State>, environmentOverrides?: EnvironmentOverrides) {
    this.debugging = options.debug ?? false;
    // This constructor is a simulated private constructor
    // it can only be called from within the static factory method create()
    // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_propertiessimulating_private_constructors
    if (!UniversalStore.isInternalConstructing) {
      throw new TypeError(
        'UniversalStore is not constructable - use UniversalStore.create() instead'
      );
    }
    UniversalStore.isInternalConstructing = false;

    this.id = options.id;
    this.actorId = globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : // TODO: remove this fallback in SB 9.0 when we no longer support Node 18
        Date.now().toString(36) + Math.random().toString(36).substring(2);
    this.actorType = options.leader
      ? UniversalStore.ActorType.LEADER
      : UniversalStore.ActorType.FOLLOWER;
    this.state = options.initialState as State;
    this.channelEventName = `${CHANNEL_EVENT_PREFIX}${this.id}`;

    this.debug('constructor', {
      options,
      environmentOverrides,
      channelEventName: this.channelEventName,
    });

    if (this.actor.type === UniversalStore.ActorType.LEADER) {
      // If this is a leader, resolve the syncing promise immediately
      // because the state doesn't need to be synced
      this.syncing = {
        state: ProgressState.RESOLVED,
        promise: Promise.resolve(),
      };
    } else {
      // Set up the syncing promise for followers, that will be resolved when the state
      // is synced with the leader
      let syncingResolve: () => void;
      let syncingReject: (error: Error) => void;
      const syncingPromise = new Promise<void>((resolve, reject) => {
        syncingResolve = () => {
          if (this.syncing!.state !== ProgressState.PENDING) {
            return;
          }
          this.syncing!.state = ProgressState.RESOLVED;
          resolve();
        };
        syncingReject = (reason) => {
          if (this.syncing!.state !== ProgressState.PENDING) {
            return;
          }
          this.syncing!.state = ProgressState.REJECTED;
          reject(reason);
        };
      });
      this.syncing = {
        state: ProgressState.PENDING,
        promise: syncingPromise,
        resolve: syncingResolve!,
        reject: syncingReject!,
      };
    }

    // Bind all methods
    this.getState = this.getState.bind(this);
    this.setState = this.setState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.onStateChange = this.onStateChange.bind(this);
    this.send = this.send.bind(this);
    this.emitToChannel = this.emitToChannel.bind(this);
    this.prepareThis = this.prepareThis.bind(this);
    this.emitToListeners = this.emitToListeners.bind(this);
    this.handleChannelEvents = this.handleChannelEvents.bind(this);
    this.debug = this.debug.bind(this);

    this.channel = environmentOverrides?.channel ?? UniversalStore.preparation.channel;
    this.environment = environmentOverrides?.environment ?? UniversalStore.preparation.environment;

    if (this.channel && this.environment) {
      this.prepareThis({ channel: this.channel, environment: this.environment });
    } else {
      UniversalStore.preparation.promise.then(this.prepareThis);
    }
  }

  /** Creates a new instance of UniversalStore */
  static create<
    State = any,
    CustomEvent extends { type: string; payload?: any } = { type: string; payload?: any },
  >(options: StoreOptions<State>): UniversalStore<State, CustomEvent> {
    if (!options || typeof options?.id !== 'string') {
      throw new TypeError('id is required and must be a string, when creating a UniversalStore');
    }
    if (options.debug) {
      console.debug(
        dedent`[UniversalStore]
        create`,
        { options }
      );
    }

    const existing = instances.get(options.id);
    if (existing) {
      console.warn(dedent`UniversalStore with id "${options.id}" already exists in this environment, re-using existing.
        You should reuse the existing instance instead of trying to create a new one.`);
      return existing;
    }

    UniversalStore.isInternalConstructing = true;
    const store = new UniversalStore<State, CustomEvent>(options);
    instances.set(options.id, store);
    return store;
  }

  /**
   * Used by Storybook to set the channel for all instances of UniversalStore in the given
   * environment.
   *
   * @internal
   */
  static __prepare(channel: ChannelLike, environment: EnvironmentType) {
    UniversalStore.preparation.channel = channel;
    UniversalStore.preparation.environment = environment;
    UniversalStore.preparation.resolve({ channel, environment });
  }

  /** Gets the current state */
  public getState = (): State => {
    this.debug('getState', { state: this.state });
    return this.state;
  };

  /**
   * Updates the store's state
   *
   * Either a new state or a state updater function can be passed to the method.
   */
  public setState(updater: State | StateUpdater<State>) {
    const previousState = this.state;
    const newState =
      typeof updater === 'function' ? (updater as StateUpdater<State>)(previousState) : updater;

    this.debug('setState', { newState, previousState, updater });

    if (this.status !== UniversalStore.Status.READY) {
      throw new TypeError(
        dedent`Cannot set state before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
          {
            newState,
            id: this.id,
            actor: this.actor,
            environment: this.environment,
          },
          null,
          2
        )}`
      );
    }

    this.state = newState;
    const event = {
      type: UniversalStore.InternalEventType.SET_STATE,
      payload: {
        state: newState,
        previousState,
      },
    };
    this.emitToChannel(event, { actor: this.actor });
    this.emitToListeners(event, { actor: this.actor });
  }

  /**
   * Subscribes to store events
   *
   * @returns A function to unsubscribe
   */

  public subscribe: {
    (listener: Listener<Event<State, CustomEvent>>): () => void;
    <EventType extends Event<State, CustomEvent>['type']>(
      eventType: EventType,
      listener: Listener<Extract<Event<State, CustomEvent>, { type: EventType }>>
    ): () => void;
  } = <EventType extends Event<State, CustomEvent>['type']>(
    eventTypeOrListener: Listener<Event<State, CustomEvent>> | EventType,
    maybeListener?: Listener<Extract<Event<State, CustomEvent>, { type: EventType }>>
  ) => {
    const subscribesToAllEvents = typeof eventTypeOrListener === 'function';

    const eventType = subscribesToAllEvents ? '*' : eventTypeOrListener;
    const listener = subscribesToAllEvents ? eventTypeOrListener : maybeListener;

    this.debug('subscribe', { eventType, listener });

    if (!listener) {
      throw new TypeError(
        `Missing first subscribe argument, or second if first is the event type, when subscribing to a UniversalStore with id '${this.id}'`
      );
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.debug('unsubscribe', { eventType, listener });
      if (!this.listeners.has(eventType)) {
        return;
      }
      this.listeners.get(eventType)!.delete(listener);
      if (this.listeners.get(eventType)?.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  };

  /**
   * Subscribes to state changes
   *
   * @returns Unsubscribe function
   */
  public onStateChange(
    listener: (state: State, previousState: State, eventInfo: EventInfo) => void
  ) {
    this.debug('onStateChange', { listener });
    return this.subscribe(
      UniversalStore.InternalEventType.SET_STATE as any,
      ({ payload }, eventInfo) => {
        listener(payload.state, payload.previousState, eventInfo);
      }
    );
  }

  /** Sends a custom event to the other stores */
  public send = (event: CustomEvent) => {
    this.debug('send', { event });
    if (this.status !== UniversalStore.Status.READY) {
      throw new TypeError(
        dedent`Cannot send event before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
          {
            event,
            id: this.id,
            actor: this.actor,
            environment: this.environment,
          },
          null,
          2
        )}`
      );
    }
    this.emitToListeners(event, { actor: this.actor });
    this.emitToChannel(event, { actor: this.actor });
  };

  private emitToChannel(event: any, eventInfo: EventInfo) {
    this.debug('emitToChannel', { event, eventInfo, channel: this.channel });
    this.channel?.emit(this.channelEventName, {
      event,
      eventInfo,
    });
  }

  private prepareThis({
    channel,
    environment,
  }: {
    channel: ChannelLike;
    environment: EnvironmentType;
  }) {
    this.channel = channel;
    this.environment = environment;

    this.debug('prepared', { channel, environment });
    this.channel.on(this.channelEventName, this.handleChannelEvents);

    if (this.actor.type === UniversalStore.ActorType.LEADER) {
      this.emitToChannel(
        { type: UniversalStore.InternalEventType.LEADER_CREATED },
        { actor: this.actor }
      );
    } else {
      this.emitToChannel(
        { type: UniversalStore.InternalEventType.FOLLOWER_CREATED },
        { actor: this.actor }
      );
      // 1. Emit a request for the existing state
      this.emitToChannel(
        { type: UniversalStore.InternalEventType.EXISTING_STATE_REQUEST },
        { actor: this.actor }
      );
      // 2. Wait 1 sec for a response, then reject the syncing promise if not already resolved
      setTimeout(() => {
        // if the state is already resolved by a response before this timeout,
        // rejecting it doesn't do anything, it will be ignored
        this.syncing!.reject!(
          new TypeError(
            `No existing state found for follower with id: '${this.id}'. Make sure a leader with the same id exists before creating a follower.`
          )
        );
      }, 1000);
    }
  }

  private emitToListeners(event: any, eventInfo: EventInfo) {
    const eventTypeListeners = this.listeners.get(event.type);
    const everythingListeners = this.listeners.get('*');
    this.debug('emitToListeners', {
      event,
      eventInfo,
      eventTypeListeners,
      everythingListeners,
    });

    [...(eventTypeListeners ?? []), ...(everythingListeners ?? [])].forEach(
      (listener: Listener<CustomEvent>) => listener(event, eventInfo)
    );
  }

  private handleChannelEvents(channelEvent: ChannelEvent<State, CustomEvent>) {
    const { event, eventInfo } = channelEvent;

    if ([eventInfo.actor.id, eventInfo.forwardingActor?.id].includes(this.actor.id)) {
      // Ignore events from self
      this.debug('handleChannelEvents: Ignoring event from self', { channelEvent });
      return;
    } else if (
      this.syncing?.state === ProgressState.PENDING &&
      event.type !== UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE
    ) {
      // Ignore events while syncing because it can cause sync issues if the state is updated
      this.debug('handleChannelEvents: Ignoring event while syncing', { channelEvent });
      return;
    }
    this.debug('handleChannelEvents', { channelEvent });

    if (this.actor.type === UniversalStore.ActorType.LEADER) {
      let shouldForwardEvent = true;
      switch (event.type) {
        case UniversalStore.InternalEventType.EXISTING_STATE_REQUEST:
          // No need to forward request events
          shouldForwardEvent = false;
          // Respond by emitting an event with the existing state
          const responseEvent: ExistingStateResponseEvent<State> = {
            type: UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE,
            payload: this.state,
          };
          this.debug('handleChannelEvents: responding to existing state request', {
            responseEvent,
          });
          this.emitToChannel(responseEvent, { actor: this.actor });
          break;
        case UniversalStore.InternalEventType.LEADER_CREATED:
          // if a leader receives a LEADER_CREATED event it should not forward it,
          // as that would lead to infinite forwarding between the two leaders
          // all instances will go in an error state in this scenario anyway
          shouldForwardEvent = false;
          this.syncing!.state = ProgressState.REJECTED;
          this.debug('handleChannelEvents: erroring due to second leader being created', {
            event,
          });
          console.error(
            dedent`Detected multiple UniversalStore leaders created with the same id "${this.id}".
            Only one leader can exists at a time, your stores are now in an invalid state.
            Leaders detected:
            this: ${JSON.stringify(this.actor, null, 2)}
            other: ${JSON.stringify(eventInfo.actor, null, 2)}`
          );

          break;
      }
      if (shouldForwardEvent) {
        // Forward the event to followers in other environments
        this.debug('handleChannelEvents: forwarding event', { channelEvent });
        this.emitToChannel(event, { actor: eventInfo.actor, forwardingActor: this.actor });
      }
    }
    if (this.actor.type === UniversalStore.ActorType.FOLLOWER) {
      switch (event.type) {
        case UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE:
          this.debug("handleChannelEvents: Setting state from leader's existing state response", {
            event,
          });
          if (this.syncing?.state !== ProgressState.PENDING) {
            // ignore the response if this follower has already synced
            break;
          }
          this.syncing!.resolve?.();
          // notify internal listeners that the state has changed because of the sync
          const setStateEvent: SetStateEvent<State> = {
            type: UniversalStore.InternalEventType.SET_STATE,
            payload: {
              state: event.payload,
              previousState: this.state,
            },
          };
          this.state = event.payload;
          this.emitToListeners(setStateEvent, eventInfo);
          break;
      }
    }

    switch (event.type) {
      case UniversalStore.InternalEventType.SET_STATE:
        this.debug('handleChannelEvents: Setting state', { event });
        this.state = event.payload.state;
        break;
    }

    this.emitToListeners(event, { actor: eventInfo.actor });
  }

  private debug(message: string, data?: any) {
    if (this.debugging) {
      console.debug(
        dedent`[UniversalStore::${this.id}::${this.environment ?? UniversalStore.Environment.UNKNOWN}]
        ${message}`,
        JSON.stringify(
          {
            data,
            actor: this.actor,
            state: this.state,
            status: this.status,
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Used to reset the static fields of the UniversalStore class when cleaning up tests
   *
   * @internal
   */
  static __reset() {
    UniversalStore.preparation.reject(new Error('reset'));
    UniversalStore.setupPreparationPromise();
    UniversalStore.isInternalConstructing = false;
  }
}
