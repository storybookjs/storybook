export interface Config {
  page: 'manager' | 'preview';
}

export interface BufferedEvent {
  event: ChannelEvent;
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

export type ChannelHandler = (event: ChannelEvent) => void;

export interface ChannelTransport {
  send(event: ChannelEvent, options?: any): void;
  setHandler(handler: ChannelHandler): void;
}

export interface ChannelEvent {
  type: string; // eventName
  from: string;
  args: any[];
}

export interface Listener {
  (...args: any[]): void;
}

export interface EventsKeyValue {
  [key: string]: Listener[];
}

/**
 * Structural interface for Channel, used in type declarations to avoid nominal incompatibility
 * between source and dist Channel class declarations.
 */
export interface ChannelLike {
  readonly isAsync: boolean;
  readonly hasTransport: boolean;
  addListener(eventName: string, listener: Listener): void;
  emit(eventName: string, ...args: any): void;
  last(eventName: string): any;
  eventNames(): string[];
  listenerCount(eventName: string): number;
  listeners(eventName: string): Listener[] | undefined;
  once(eventName: string, listener: Listener): void;
  removeAllListeners(eventName?: string): void;
  removeListener(eventName: string, listener: Listener): void;
  on(eventName: string, listener: Listener): void;
  off(eventName: string, listener: Listener): void;
}
export type ChannelArgs = ChannelArgsSingle | ChannelArgsMulti;
export interface ChannelArgsSingle {
  transport?: ChannelTransport;
  async?: boolean;
}
export interface ChannelArgsMulti {
  transports: ChannelTransport[];
  async?: boolean;
}
