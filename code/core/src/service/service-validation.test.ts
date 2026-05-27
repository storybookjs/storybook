import { dedent } from 'ts-dedent';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import { ServiceValidationError } from './service-validation.ts';

afterEach(() => {
  __resetServiceRegistry();
});

describe('ServiceValidationError formatting', () => {
  it('formats invalid query input with service id and field path', () => {
    const def = defineService()({
      id: 'test/validate-q-in',
      state: { byId: { a: 'alpha' } },
      queries: {
        getById: {
          input: z.object({ entryId: z.string() }),
          output: z.string().optional(),
          handler: (s: { byId: Record<string, string> }, { entryId }: { entryId: string }) =>
            s.byId[entryId],
        },
      },
      commands: {},
    });
    const service = registerService(def);

    try {
      service.queries.getById({} as unknown as { entryId: string });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceValidationError);
      expect((error as ServiceValidationError).message).toMatch(
        /Invalid input for query "test\/validate-q-in\.getById":\nentryId:/
      );
    }
  });

  it('formats nested output paths (arrays and objects)', () => {
    const def = defineService()({
      id: 'test/nested-q-out',
      state: {},
      queries: {
        getBrokenTree: {
          input: z.void(),
          output: z.object({
            items: z.array(z.object({ name: z.string() })),
          }),
          handler: () => ({
            items: [{ name: 1 as unknown as string }],
          }),
        },
      },
      commands: {},
    });
    const service = registerService(def);

    try {
      service.queries.getBrokenTree();
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceValidationError);
      expect((error as ServiceValidationError).message).toBe(
        dedent`
          Invalid output for query "test/nested-q-out.getBrokenTree":
          items[0].name: Expected string, received number
        `
      );
    }
  });

  it('formats invalid command input', async () => {
    const def = defineService()({
      id: 'test/validate-cmd-in',
      state: { n: 0 },
      queries: {
        get: { input: z.void(), output: z.number(), handler: (s: { n: number }) => s.n },
      },
      commands: {
        set: {
          input: z.number(),
          output: z.void(),
          handler: (n: number, ctx: import('./types.ts').ServiceCtx<{ n: number }>) =>
            ctx.self.setState((d: { n: number }) => {
              d.n = n;
            }),
        },
      },
    });
    const service = registerService(def);

    await expect(service.commands.set('x' as unknown as number)).rejects.toMatchObject({
      name: 'ServiceValidationError',
      operationName: 'set',
      phase: 'input',
    });
  });
});
