/**
 * React hook to get a stable reference to a service command.
 *
 * Fire-and-forget: the returned async function invokes the command and returns a Promise.
 * Callers manage their own loading/error state. This keeps the hook minimal and composable
 * with any state management approach (local `useState`, `useReducer`, TanStack Query, etc.).
 *
 * The reference is stable as long as `service` and `commandName` do not change, so it is
 * safe to pass to child components or include in effect dependency arrays.
 */

import * as React from 'react';

import type { RuntimeService } from './types.ts';

type CommandFn<TCommands, TKey extends keyof TCommands> = TCommands[TKey] extends (
  ...args: any[]
) => any
  ? TCommands[TKey]
  : never;

/**
 * Returns a stable reference to the named service command.
 *
 * @param service - A service instance from `registerServiceClient` or `registerService`.
 * @param commandName - The name of the command to invoke.
 *
 * @example
 * ```tsx
 * const assignField = useServiceCommand(service, 'assignRecordField');
 *
 * return (
 *   <button onClick={() => assignField({ entryId: 'a', fieldKey: 'x', fieldValue: 'y' })}>
 *     Update
 *   </button>
 * );
 * ```
 */
export function useServiceCommand<
  TInstance extends Pick<RuntimeService, 'commands'>,
  TKey extends keyof TInstance['commands'] & string,
>(service: TInstance, commandName: TKey): CommandFn<TInstance['commands'], TKey> {
  return React.useMemo(
    () => service.commands[commandName] as CommandFn<TInstance['commands'], TKey>,
    [service, commandName]
  );
}
