import { whenChannelInstalled } from '@storybook/core/internal/channels';

import { dedent } from 'ts-dedent';

import { UniversalStoreFollowerTimeoutError } from '../../manager-errors.ts';
import { getInstanceContext } from '../instance-context.ts';
import { isFirstPartyStoreId } from './first-party-store-ids.ts';
import type {
  Actor,
  BaseEvent,
  ChannelLike,
  Event,
  EventInfo,
  Listener,
  SetStateEvent,
  StateUpdater,
  StatusType,
  StoreMessage,
  StoreOptions,
} from './types.ts';

const CHANNEL_EVENT_PREFIX = 'UNIVERSAL_STORE:' as const;
const SYNC_TIMEOUT_MS = 1000;
const CLIENT_KINDS = new Set(['state-request', 'set-state', 'send']);

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

/**
 * State shared between one owner and any number of clients over a channel.
 *
 * The owner holds the state: on the server it is the Storybook instance, in a static build the
 * manager. Clients (the manager in dev, an attached tools host, the Vitest child) request the
 * owner's state, route writes and events through it, and mirror what it broadcasts.
 *
 * @example
 *
 * ```ts
 * const owner = UniversalStore.create({ id: 'storybook/test', owner: true, channel, initialState });
 * const client = UniversalStore.create({ id: 'storybook/test', channel });
 * await client.untilReady();
 * client.setState((state) => ({ ...state, count: state.count + 1 })); // the owner applies it
 * ```
 */
export class UniversalStore<State, CustomEvent extends BaseEvent = BaseEvent> {
  public static readonly ActorType = {
    OWNER: 'OWNER',
    CLIENT: 'CLIENT',
  } as const;

  public static readonly InternalEventType = {
    SET_STATE: '__SET_STATE',
  } as const;

  public static readonly Status = {
    UNPREPARED: 'UNPREPARED',
    SYNCING: 'SYNCING',
    READY: 'READY',
    ERROR: 'ERROR',
  } as const;

  /** Enable debug logs for this store */
  public debugging = false;

  public readonly id: string;

  /** The actor object representing the store instance with a unique ID and a type */
  public readonly actor: Actor;

  private state: State;

  private channel?: ChannelLike;

  private readonly channelEventName: string;

  private readonly listeners: Map<string, Set<Listener<any>>> = new Map([['*', new Set()]]);

  private syncStatus: StatusType;

  private sync?: Deferred;

  private syncTimeout?: ReturnType<typeof setTimeout>;

  private disposed = false;

  /** The last write this client sent; its echo carries the same number. */
  private seq = 0;

  /** Whether another actor's state arrived after this client's last write. */
  private overwrittenSinceWrite = false;

  protected constructor(
    options: StoreOptions<State> & { channel: ChannelLike | Promise<ChannelLike> }
  ) {
    this.debugging = options.debug ?? false;
    this.id = options.id;
    this.actor = Object.freeze({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      type: options.owner ? UniversalStore.ActorType.OWNER : UniversalStore.ActorType.CLIENT,
    });
    this.state = options.initialState as State;
    this.channelEventName = `${CHANNEL_EVENT_PREFIX}${this.id}`;
    this.syncStatus = UniversalStore.Status.UNPREPARED;

    this.setState = this.setState.bind(this);
    this.onStateChange = this.onStateChange.bind(this);
    this.untilReady = this.untilReady.bind(this);
    this.handleMessage = this.handleMessage.bind(this);

    if (this.isOwner) {
      this.sync = deferred();
    } else {
      this.startSync();
    }

    if ('then' in options.channel) {
      options.channel.then((channel) => this.connect(channel), this.sync!.reject);
    } else {
      this.connect(options.channel);
    }
  }

  /**
   * Creates a store. Without a `channel` it syncs on the current instance's channel on the server
   * (and is disposed when that instance closes), or on the page's channel in the browser.
   */
  static create<State = any, CustomEvent extends BaseEvent = BaseEvent>(
    options: StoreOptions<State>
  ): UniversalStore<State, CustomEvent> {
    if (!options || typeof options?.id !== 'string') {
      throw new TypeError('id is required and must be a string, when creating a UniversalStore');
    }
    if (!isFirstPartyStoreId(options.id)) {
      throw new TypeError(
        `UniversalStore is internal to Storybook and cannot create a store with id "${options.id}"`
      );
    }
    const context = options.channel ? undefined : getInstanceContext();
    const channel = options.channel ?? context?.channel ?? defaultChannel();
    const store = new UniversalStore<State, CustomEvent>({ ...options, channel });
    context?.cleanups.add(() => store.__dispose());
    return store;
  }

  /**
   * The owner's status is `READY` once it has a channel. A client is `SYNCING` until the owner's
   * state arrives, and `ERROR` when it timed out waiting; a late answer still makes it `READY`.
   */
  public get status(): StatusType {
    return this.syncStatus;
  }

  /** Resolves when the store is ready; a client that timed out asks the owner again. */
  public untilReady(): Promise<void> {
    if (this.syncStatus === UniversalStore.Status.ERROR && !this.disposed) {
      this.startSync();
      this.requestState();
    }
    return this.sync!.promise;
  }

  /** Gets the current state */
  public getState = (): State => {
    return this.state;
  };

  /** Updates the state; a client applies it locally and forwards it to the owner. */
  public setState(updater: State | StateUpdater<State>): void {
    const previousState = this.state;
    const state =
      typeof updater === 'function' ? (updater as StateUpdater<State>)(previousState) : updater;
    this.debug('setState', { state, previousState });
    this.assertReady('set state', { state });

    this.state = state;
    const eventInfo = { actor: this.actor };
    if (this.isOwner) {
      this.emitToChannel({ kind: 'state-changed', state, previousState, eventInfo });
    } else {
      this.seq++;
      this.overwrittenSinceWrite = false;
      this.emitToChannel({ kind: 'set-state', from: this.actor, seq: this.seq, state });
    }
    this.emitToListeners(setStateEvent(state, previousState), eventInfo);
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
      this.listeners.get(eventType)?.delete(listener);
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
  ): () => void {
    return this.subscribe(
      UniversalStore.InternalEventType.SET_STATE as any,
      (({ payload }: SetStateEvent<State>, eventInfo: EventInfo) => {
        listener(payload.state, payload.previousState, eventInfo);
      }) as Listener<any>
    );
  }

  /** Sends a custom event to the owner and every client */
  public send = (event: CustomEvent): void => {
    this.debug('send', { event });
    this.assertReady('send event', { event });
    const eventInfo = { actor: this.actor };
    this.emitToListeners(event, eventInfo);
    this.emitToChannel(
      this.isOwner ? { kind: 'event', event, eventInfo } : { kind: 'send', from: this.actor, event }
    );
  };

  /**
   * The owner's broadcast of `event`, as a client receives it on the channel.
   *
   * @internal
   */
  static eventMessage<TEvent extends BaseEvent>(
    event: TEvent,
    eventInfo: EventInfo
  ): StoreMessage<never, TEvent> {
    return { kind: 'event', event, eventInfo };
  }

  /**
   * Whether a channel message was sent by an owner, so a bridge forwards it to clients.
   *
   * @internal
   */
  static isOwnerMessage(message: unknown): message is StoreMessage<unknown, BaseEvent> {
    const kind = (message as { kind?: unknown } | undefined)?.kind;
    return typeof kind === 'string' && !CLIENT_KINDS.has(kind);
  }

  /** Stops listening on the channel and drops all listeners. @internal */
  public __dispose(): void {
    this.disposed = true;
    this.channel?.off(this.channelEventName, this.handleMessage);
    clearTimeout(this.syncTimeout);
    this.listeners.clear();
    this.channel = undefined;
  }

  private get isOwner(): boolean {
    return this.actor.type === UniversalStore.ActorType.OWNER;
  }

  private connect(channel: ChannelLike): void {
    if (this.disposed) {
      return;
    }
    this.channel = channel;
    channel.on(this.channelEventName, this.handleMessage);
    if (this.isOwner) {
      this.syncStatus = UniversalStore.Status.READY;
      this.sync!.resolve();
      // Clients that timed out before this owner existed pick up its state from this broadcast.
      this.emitToChannel({
        kind: 'state-changed',
        state: this.state,
        previousState: this.state,
        eventInfo: { actor: this.actor },
      });
    } else {
      this.requestState();
    }
  }

  private startSync(): void {
    this.sync = deferred();
    this.syncStatus = this.channel ? UniversalStore.Status.SYNCING : this.syncStatus;
  }

  private requestState(): void {
    if (!this.channel) {
      return;
    }
    this.syncStatus = UniversalStore.Status.SYNCING;
    this.emitToChannel({ kind: 'state-request', from: this.actor });
    clearTimeout(this.syncTimeout);
    const { reject } = this.sync!;
    this.syncTimeout = setTimeout(() => {
      if (this.syncStatus === UniversalStore.Status.SYNCING) {
        this.syncStatus = UniversalStore.Status.ERROR;
        reject(new UniversalStoreFollowerTimeoutError(this.id));
      }
    }, SYNC_TIMEOUT_MS);
  }

  private handleMessage(message: StoreMessage<State, CustomEvent>): void {
    this.debug('handleMessage', { message });
    if (this.isOwner) {
      this.handleClientMessage(message);
    } else {
      this.handleOwnerMessage(message);
    }
  }

  private handleClientMessage(message: StoreMessage<State, CustomEvent>): void {
    switch (message.kind) {
      case 'state-request':
        this.emitToChannel({
          kind: 'state',
          to: message.from.id,
          state: this.state,
          from: this.actor,
        });
        break;
      case 'set-state': {
        const previousState = this.state;
        const eventInfo = { actor: message.from };
        this.state = message.state;
        this.emitToChannel({
          kind: 'state-changed',
          state: message.state,
          previousState,
          eventInfo,
          seq: message.seq,
        });
        this.emitToListeners(setStateEvent(message.state, previousState), eventInfo);
        break;
      }
      case 'send': {
        const eventInfo = { actor: message.from };
        this.emitToChannel({ kind: 'event', event: message.event, eventInfo });
        this.emitToListeners(message.event, eventInfo);
        break;
      }
    }
  }

  private handleOwnerMessage(message: StoreMessage<State, CustomEvent>): void {
    switch (message.kind) {
      case 'state':
        // A ready client already follows every broadcast, so a late reply would only be stale.
        if (message.to === this.actor.id && this.syncStatus !== UniversalStore.Status.READY) {
          this.applyOwnerState(message.state, { actor: message.from });
        }
        break;
      case 'state-changed': {
        const own = message.eventInfo.actor.id === this.actor.id;
        if (this.syncStatus === UniversalStore.Status.READY && own) {
          // An older echo is superseded by a later write, and the latest one matches local state
          // unless another actor's state arrived in between.
          if (message.seq !== this.seq || !this.overwrittenSinceWrite) {
            if (message.seq === this.seq) {
              this.state = message.state;
            }
            break;
          }
        }
        if (!own) {
          this.overwrittenSinceWrite = true;
        }
        this.applyOwnerState(message.state, message.eventInfo);
        break;
      }
      case 'event':
        if (
          this.syncStatus === UniversalStore.Status.READY &&
          message.eventInfo.actor.id !== this.actor.id
        ) {
          this.emitToListeners(message.event, message.eventInfo);
        }
        break;
    }
  }

  private applyOwnerState(state: State, eventInfo: EventInfo): void {
    const previousState = this.state;
    this.state = state;
    if (this.syncStatus !== UniversalStore.Status.READY) {
      clearTimeout(this.syncTimeout);
      this.syncStatus = UniversalStore.Status.READY;
      this.sync!.resolve();
    }
    this.emitToListeners(setStateEvent(state, previousState), eventInfo);
  }

  private assertReady(action: string, data: Record<string, unknown>): void {
    if (this.syncStatus !== UniversalStore.Status.READY) {
      throw new TypeError(
        dedent`Cannot ${action} before store is ready. You can get the current status with store.status,
        or await store.untilReady() to wait for the store to be ready.
        ${JSON.stringify({ ...data, id: this.id, actor: this.actor }, null, 2)}`
      );
    }
  }

  private emitToChannel(message: StoreMessage<State, CustomEvent>): void {
    this.debug('emitToChannel', { message });
    this.channel?.emit(this.channelEventName, message);
  }

  private emitToListeners(event: Event<State, CustomEvent>, eventInfo: EventInfo): void {
    [...(this.listeners.get(event.type) ?? []), ...(this.listeners.get('*') ?? [])].forEach(
      (listener) => listener(event, eventInfo)
    );
  }

  private debug(message: string, data?: unknown): void {
    if (this.debugging) {
      console.debug(
        dedent`[UniversalStore::${this.id}::${this.actor.type}]
        ${message}`,
        JSON.stringify({ data, state: this.state, status: this.status }, null, 2)
      );
    }
  }
}

function setStateEvent<State>(state: State, previousState: State): SetStateEvent<State> {
  return {
    type: UniversalStore.InternalEventType.SET_STATE,
    payload: { state, previousState },
  };
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  // Callers that never await the sync must not see an unhandled rejection.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

/**
 * The page's channel in the browser. Node has no process-wide channel to fall back to, so a store
 * created there outside an instance (a manager module imported by a Node test) stays unprepared.
 */
function defaultChannel(): Promise<ChannelLike> {
  return typeof window === 'undefined' ? new Promise(() => {}) : whenChannelInstalled();
}
