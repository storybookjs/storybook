import type { Channel } from 'storybook/internal/channels';

type Listener<State> = (state: State) => void;

const UNIVERSAL_STATE_CHANGE_PREFIX = 'universal-state:change';
const UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX = 'universal-state:existing-request';
const UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX = 'universal-state:existing-response';

export class UniversalState<State = any> {
  #state: State;

  #id: string;

  #channel: Channel;

  #listeners: Listener<State>[] = [];

  constructor(id: string, channel: Channel, defaultState?: State) {
    this.#id = id;
    this.#channel = channel;
    this.#state = defaultState;

    this.#channel.on(`${UNIVERSAL_STATE_CHANGE_PREFIX}:${this.#id}`, this.#changeListener);
    this.#channel.once(
      `${UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX}:${this.#id}`,
      this.#existingResponseListener
    );
    this.#channel.emit(`${UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX}:${this.#id}`);
    this.#channel.on(
      `${UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX}:${this.#id}`,
      this.#existingRequestListener
    );
  }

  // static async createWithExisting<State = any>(id: string, channel: Channel, defaultState?: State) {
  //   const instance = new UniversalState<State>(id, channel, defaultState);
  //   let timeoutId: number;
  //   await Promise.race([
  //     new Promise((resolve) => {
  //       const now = Date.now();
  //       console.log('LOG: asking for current state', now);
  //       channel.once(`${UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX}:${id}`, (state) => {
  //         console.log('LOG: got current state', state, Date.now() - now);
  //         clearTimeout(timeoutId);
  //         resolve(void 0);
  //       });
  //       channel.emit(`${UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX}:${id}`);
  //     }),
  //     new Promise((resolve) => {
  //       timeoutId = setTimeout(() => {
  //         console.log('LOG: timeout');
  //         if (defaultState) {
  //           instance.#state = defaultState;
  //           instance.#notify();
  //         }
  //         resolve(void 0);
  //       }, 300) as unknown as number;
  //     }),
  //   ]);
  //   instance.#channel.on(
  //     `${UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX}:${instance.#id}`,
  //     instance.#existingRequestListener
  //   );
  //   return instance;
  // }

  subscribe = (listener: Listener<State>): (() => void) => {
    this.#listeners.push(listener);
    return () => {
      this.unsubscribe(listener);
    };
  };

  unsubscribe = (listener: Listener<State>) => {
    this.#listeners = this.#listeners.filter((l) => l !== listener);
  };

  destroy = () => {
    this.#channel.off(`${UNIVERSAL_STATE_CHANGE_PREFIX}:${this.#id}`, this.#changeListener);
    this.#channel.off(
      `${UNIVERSAL_STATE_EXISTING_REQUEST_PREFIX}:${this.#id}`,
      this.#existingRequestListener
    );
    this.#channel.off(
      `${UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX}:${this.#id}`,
      this.#existingResponseListener
    );
  };

  #changeListener = (state: State) => {
    this.#channel.off(
      `${UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX}:${this.#id}`,
      this.#existingResponseListener
    );
    this.#state = state;
    this.#notifyInternalListeners();
  };

  #existingRequestListener = () => {
    this.#channel.emit(`${UNIVERSAL_STATE_EXISTING_RESPONSE_PREFIX}:${this.#id}`, this.#state);
  };

  #existingResponseListener = (state: State) => {
    this.#state = state;
    this.#notifyInternalListeners();
  };

  #notifyInternalListeners = () => {
    this.#listeners.forEach((listener) => listener(this.#state));
  };

  #notifyChannelListeners = () => {
    this.#channel.emit(`${UNIVERSAL_STATE_CHANGE_PREFIX}:${this.#id}`, this.#state);
  };

  get state() {
    return this.#state;
  }

  set state(state: State) {
    // TODO: bail if deep equal?
    this.#state = state;
    this.#notifyChannelListeners();
  }
}
