import { pathToFileURL } from 'node:url';

import { serializeError } from '../../../shared/open-service/service-error-serialization.ts';
import type { AnyToolsetOutcome } from '../../../shared/open-service/toolset-definition.ts';
import { createTools } from './create-tools.ts';
import {
  CHILD_HOST_PROTOCOL_VERSION,
  type ParentMessage,
  type ChildMessage,
} from './child-protocol.ts';
import { ToolsRuntimeError } from './errors.ts';
import type { Tools, ToolsetCatalog } from './types.ts';

export async function runChildHost({
  send = (message) => {
    process.send?.(message);
  },
  subscribe = (handler) => {
    process.on('message', handler);
  },
  cwd = () => process.cwd(),
}: {
  send?: (message: ChildMessage) => void;
  subscribe?: (handler: (message: unknown) => void) => void;
  cwd?: () => string;
} = {}): Promise<void> {
  process.on('disconnect', () => {
    process.exit(0);
  });
  process.env.STORYBOOK_TOOLS_CHILD_HOST = 'true';

  let tools: Tools | undefined;
  const controllers = new Map<string, AbortController>();

  const handle = async (raw: unknown): Promise<void> => {
    const message = raw as ParentMessage;
    switch (message.type) {
      case 'init': {
        tools = await createTools({
          ...message.options,
          cwd: cwd(),
          mode: message.options.mode ?? 'attached',
          autoSpawn: false,
        });
        send({
          type: 'hello',
          version: CHILD_HOST_PROTOCOL_VERSION,
          storybook: tools.storybook,
          clientInfo: tools.clientInfo,
        });
        return;
      }
      case 'describe': {
        await reply(message.id, tools, () => tools!.describe(message.options));
        return;
      }
      case 'call': {
        const controller = new AbortController();
        controllers.set(message.id, controller);
        try {
          await reply(message.id, tools, () =>
            tools!.call(message.ref, message.input, {
              signal: controller.signal,
              telemetry: async (event, payload) => {
                send({ type: 'telemetry', id: message.id, event, payload });
              },
            })
          );
        } finally {
          controllers.delete(message.id);
        }
        return;
      }
      case 'cancel': {
        controllers.get(message.id)?.abort();
        return;
      }
      case 'close': {
        await tools?.close();
        process.exit(0);
        return;
      }
      default: {
        const exhaustive: never = message;
        throw exhaustive;
      }
    }
  };

  async function reply(
    id: string,
    host: Tools | undefined,
    run: () => Promise<ToolsetCatalog | AnyToolsetOutcome>
  ): Promise<void> {
    if (!host) {
      send({
        type: 'error',
        id,
        error: serializeError(
          new ToolsRuntimeError({
            reason: 'command-unhandled',
            message: 'The child host has not been initialized.',
          })
        ),
      });
      return;
    }
    try {
      send({ type: 'result', id, value: await run() });
    } catch (error) {
      send({ type: 'error', id, error: serializeError(error) });
    }
  }

  subscribe((message) => {
    void handle(message).catch((error) => {
      const fallbackId =
        typeof message === 'object' &&
        message !== null &&
        'id' in message &&
        typeof message.id === 'string'
          ? message.id
          : 'init';
      send({ type: 'error', id: fallbackId, error: serializeError(error) });
    });
  });
}

function isExecutedAsEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isExecutedAsEntry()) {
  void runChildHost();
}
