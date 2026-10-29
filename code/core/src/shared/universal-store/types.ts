import type { Channel } from '@storybook/core/internal/channels';

import type { UniversalStore } from './index.ts';

export type StatusType = (typeof UniversalStore.Status)[keyof typeof UniversalStore.Status];

export type StateUpdater<TState> = (prevState: TState) => TState;

/** The store that caused an event: the owner, or one of its clients. */
export type Actor = {
  /** Unique per store object. */
  id: string;
  /** Whether that store owns the state or mirrors it. */
  type: (typeof UniversalStore.ActorType)[keyof typeof UniversalStore.ActorType];
};

export type EventInfo = {
  /** The store whose `setState` or `send` caused the event. */
  actor: Actor;
};

export type Listener<TEvent> = (event: TEvent, eventInfo: EventInfo) => void;

export type BaseEvent = {
  type: string;
  payload?: any;
};

export interface SetStateEvent<TState> extends BaseEvent {
  type: typeof UniversalStore.InternalEventType.SET_STATE;
  payload: {
    state: TState;
    previousState: TState;
  };
}

export type InternalEvent<TState> = SetStateEvent<TState>;

export type Event<TState, TEvent extends BaseEvent> = TEvent | InternalEvent<TState>;

export type ChannelLike = Pick<Channel, 'on' | 'off' | 'emit'>;

/**
 * What travels on the store's channel event. Clients only send the first three kinds; the owner only
 * sends the last three.
 */
export type StoreMessage<TState, TEvent extends BaseEvent> =
  | { kind: 'state-request'; from: Actor }
  | { kind: 'set-state'; from: Actor; seq: number; state: TState }
  | { kind: 'send'; from: Actor; event: TEvent }
  | { kind: 'state'; to: Actor['id']; state: TState; from: Actor }
  | {
      kind: 'state-changed';
      state: TState;
      previousState: TState;
      eventInfo: EventInfo;
      seq?: number;
    }
  | { kind: 'event'; event: TEvent; eventInfo: EventInfo };

export type StoreOptions<TState> = {
  id: string;
  /** The owner holds the state; clients mirror it and route writes through the owner. */
  owner?: boolean;
  /**
   * The channel to sync on. Defaults to the current instance's channel on the server, or the
   * page's channel in the browser once it is installed.
   */
  channel?: ChannelLike | Promise<ChannelLike>;
  initialState?: TState;
  debug?: boolean;
};
