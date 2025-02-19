import type { Channel } from 'storybook/internal/channels';

import type { UniversalStore } from '.';

export type EnvironmentType =
  (typeof UniversalStore.Environment)[keyof typeof UniversalStore.Environment];

export type StatusType = (typeof UniversalStore.Status)[keyof typeof UniversalStore.Status];

export type StateUpdater<TState> = (prevState: TState) => TState;
export type Actor = {
  id: string;
  type: (typeof UniversalStore.ActorType)[keyof typeof UniversalStore.ActorType];
  environment: EnvironmentType;
};
export type EventInfo = {
  actor: Actor;
  forwardingActor?: Actor;
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
export interface ExistingStateRequestEvent extends BaseEvent {
  type: typeof UniversalStore.InternalEventType.EXISTING_STATE_REQUEST;
  payload: never;
}
export interface ExistingStateResponseEvent<TState> extends BaseEvent {
  type: typeof UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE;
  payload: TState;
}
export interface LeaderCreatedEvent extends BaseEvent {
  type: typeof UniversalStore.InternalEventType.LEADER_CREATED;
  payload: never;
}
export interface FollowerCreatedEvent extends BaseEvent {
  type: typeof UniversalStore.InternalEventType.FOLLOWER_CREATED;
  payload: never;
}

export type InternalEvent<TState> =
  | SetStateEvent<TState>
  | ExistingStateRequestEvent
  | ExistingStateResponseEvent<TState>
  | FollowerCreatedEvent
  | LeaderCreatedEvent;
export type Event<TState, TEvent extends BaseEvent> = TEvent | InternalEvent<TState>;

export type ChannelEvent<TState, TEvent extends BaseEvent> = {
  event: Event<TState, TEvent>;
  eventInfo: EventInfo;
};

export type ChannelLike = Pick<Channel, 'on' | 'off' | 'emit'>;

export type StoreOptions<TState> = {
  id: string;
  leader?: boolean;
  initialState?: TState;
  debug?: boolean;
};

export type EnvironmentOverrides = {
  channel: ChannelLike;
  environment: EnvironmentType;
};
