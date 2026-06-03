/**
 * Topic-based event routing channel for cross-iframe communication.
 * Supports wildcard pattern matching for flexible topic subscriptions.
 * Core connector used in Storybook's manager-preview Channel architecture.
 */

export type TopicPattern = string;

export interface TopicMessage {
  topic: string;
  event: string;
  payload?: unknown;
}

export type TopicHandler = (msg: TopicMessage) => void;
export type UnsubscribeFn = () => void;

/**
 * Determines if a topic matches a given pattern.
 * Patterns ending with '*' are treated as prefix matchers.
 *
 * @example
 * matchesTopic('storybook/*', 'storybook/ui/panel') // true
 * matchesTopic('storybook', 'storybook/ui')          // false
 */
export function matchesTopic(pattern: TopicPattern, topic: string): boolean {
  if (!pattern || !topic) {
    return false;
  }

  if (pattern.endsWith('*')) {
    return topic.startsWith(pattern.slice(0, -1));
  }

  return pattern === topic;
}

/**
 * Topic-based event channel with wildcard subscription support.
 * Decouples manager and preview via pattern-routed pub/sub messaging.
 */
export class TopicChannel {
  private readonly listeners = new Map<TopicPattern, Set<TopicHandler>>();
  private readonly universalListeners = new Set<TopicHandler>();
  private isDestroyed = false;
  private errorHandler: ((error: Error, msg: TopicMessage) => void) | null = null;

  /**
   * Subscribes to messages matching a topic pattern.
   *
   * @param pattern Topic pattern (use '*' suffix for prefix matching)
   * @param handler Callback invoked when topic matches
   * @returns Unsubscribe function
   * @throws Error if channel is destroyed or arguments are invalid
   *
   * @example
   * const unsub = channel.subscribe('storybook/ui/*', (msg) => {
   *   console.log(msg.event, msg.payload);
   * });
   * unsub();
   */
  subscribe(pattern: TopicPattern, handler: TopicHandler): UnsubscribeFn {
    if (this.isDestroyed) {
      throw new Error('TopicChannel has been destroyed');
    }

    if (!pattern || typeof pattern !== 'string') {
      throw new Error(`Invalid topic pattern: ${pattern}`);
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this.listeners.has(pattern)) {
      this.listeners.set(pattern, new Set());
    }

    const handlers = this.listeners.get(pattern)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(pattern);
      }
    };
  }

  /**
   * Subscribes to all messages regardless of topic.
   *
   * @param handler Callback invoked for every message
   * @returns Unsubscribe function
   */
  subscribeAll(handler: TopicHandler): UnsubscribeFn {
    if (this.isDestroyed) {
      throw new Error('TopicChannel has been destroyed');
    }

    this.universalListeners.add(handler);

    return () => {
      this.universalListeners.delete(handler);
    };
  }

  /**
   * Emits a message to all matching subscribers.
   *
   * @param topic Topic routing key
   * @param event Event name/type
   * @param payload Optional message payload
   * @throws Error if channel is destroyed or arguments are invalid
   *
   * @example
   * channel.emit('storybook/ui/sidebar', 'story-selected', { storyId: 'button--primary' });
   */
  emit(topic: string, event: string, payload?: unknown): void {
    if (this.isDestroyed) {
      throw new Error('TopicChannel has been destroyed');
    }

    if (!topic || typeof topic !== 'string') {
      throw new Error(`Invalid topic: ${topic}`);
    }

    if (!event || typeof event !== 'string') {
      throw new Error(`Invalid event: ${event}`);
    }

    const msg: TopicMessage = { topic, event, payload };

    // Invoke universal listeners first
    for (const handler of this.universalListeners) {
      try {
        handler(msg);
      } catch (error) {
        this.invokeErrorHandler(error, msg);
      }
    }

    // Invoke pattern-matched listeners
    for (const [pattern, handlers] of this.listeners) {
      if (matchesTopic(pattern, topic)) {
        for (const handler of handlers) {
          try {
            handler(msg);
          } catch (error) {
            this.invokeErrorHandler(error, msg);
          }
        }
      }
    }
  }

  /**
   * Legacy event API adapter: subscribe to namespaced events.
   * Automatically prefixes topic with 'storybook/'.
   *
   * @param eventName Event name (becomes 'storybook/{eventName}' topic)
   * @param handler Callback receiving only the payload
   * @returns Unsubscribe function
   *
   * @example
   * channel.legacyOn('story-changed', (payload) => console.log(payload));
   */
  legacyOn(eventName: string, handler: (payload: unknown) => void): UnsubscribeFn {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    return this.subscribe(`storybook/${eventName}`, ({ payload }) => {
      try {
        handler(payload);
      } catch (error) {
        this.invokeErrorHandler(error, { topic: `storybook/${eventName}`, event: eventName, payload });
      }
    });
  }

  /**
   * Legacy event API adapter: emit namespaced events.
   * Automatically prefixes topic with 'storybook/'.
   *
   * @param eventName Event name (becomes 'storybook/{eventName}' topic)
   * @param payload Optional message payload
   *
   * @example
   * channel.legacyEmit('story-changed', { storyId: 'button--primary' });
   */
  legacyEmit(eventName: string, payload?: unknown): void {
    this.emit(`storybook/${eventName}`, eventName, payload);
  }

  /**
   * Registers a custom error handler for handler invocation errors.
   * Default behavior: log to console.
   *
   * @param handler Callback invoked with (error, message) on handler exception
   */
  setErrorHandler(handler: (error: Error, msg: TopicMessage) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Returns subscriber count for introspection.
   *
   * @param pattern Optional pattern to count; if omitted, returns total
   * @returns Number of handlers
   */
  getSubscriberCount(pattern?: TopicPattern): number {
    if (pattern === undefined) {
      let total = this.universalListeners.size;
      for (const handlers of this.listeners.values()) {
        total += handlers.size;
      }
      return total;
    }

    return this.listeners.get(pattern)?.size ?? 0;
  }

  /**
   * Returns all registered topic patterns.
   *
   * @returns Array of subscribed patterns
   */
  getPatterns(): TopicPattern[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Clears all subscriptions.
   *
   * @param pattern Optional pattern to clear; if omitted, clears all
   */
  clear(pattern?: TopicPattern): void {
    if (pattern === undefined) {
      this.listeners.clear();
      this.universalListeners.clear();
    } else {
      this.listeners.delete(pattern);
    }
  }

  /**
   * Gracefully shuts down the channel, preventing further subscriptions and emissions.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
    this.errorHandler = null;
  }

  private invokeErrorHandler(error: unknown, msg: TopicMessage): void {
    const err = error instanceof Error ? error : new Error(String(error));

    if (this.errorHandler) {
      try {
        this.errorHandler(err, msg);
      } catch (handlerError) {
        console.error('TopicChannel error handler threw:', handlerError);
      }
    } else {
      console.error(`TopicChannel error on [${msg.topic}/${msg.event}]:`, err);
    }
  }
}