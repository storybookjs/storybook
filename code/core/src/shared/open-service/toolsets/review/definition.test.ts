import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { ToolsetCtx } from '../../toolset-definition.ts';
import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import { reviewToolset } from './definition.ts';

const input = {
  title: 'Button tweaks',
  description: 'Check primary',
  collections: [
    {
      title: 'Primary',
      rationale: 'edited',
      storyIds: ['button--primary'],
    },
  ],
  changedFiles: ['src/Button.tsx'],
};

const setReview = vi.fn();
let ctx: ToolsetCtx;
let serviceError: Error | undefined;

function createReview(
  overrides: Partial<v.InferInput<typeof reviewToolset.methods.create.schema>> = {}
) {
  return reviewToolset.methods.create.handler(
    v.parse(reviewToolset.methods.create.schema, { ...input, ...overrides }),
    ctx
  );
}

describe('review API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceError = undefined;
    setReview.mockImplementation(async () => {
      if (serviceError) {
        throw serviceError;
      }
    });
    ctx = {
      consumer: 'cli',
      origin: 'http://localhost:6006/',
      format: 'markdown',
      getService: vi.fn(() => ({ commands: { setReview } })) as ToolsetCtx['getService'],
    };
  });

  it('rejects with a missing-origin error when no server origin is configured', async () => {
    ctx.origin = undefined;

    await expect(createReview()).rejects.toBeInstanceOf(OpenServiceMissingOriginError);
    expect(setReview).not.toHaveBeenCalled();
  });

  it('propagates service errors unchanged', async () => {
    serviceError = new Error('review service unavailable');

    await expect(createReview()).rejects.toBe(serviceError);
  });

  it('sets review state and returns Markdown by default', async () => {
    await expect(createReview()).resolves.toBe(
      'Review created: http://localhost:6006/?path=/review/'
    );
    expect(setReview).toHaveBeenCalledWith(input);
    expect(ctx.getService).toHaveBeenCalledWith('core/review', { internal: true });
  });

  it('adds the user-facing instruction only for the MCP Markdown response', async () => {
    const cliResult = await createReview();
    ctx.consumer = 'mcp';
    const mcpResult = await createReview();

    expect(cliResult).not.toContain('Show this review URL');
    expect(mcpResult).toBe(
      `${cliResult}\n\nShow this review URL to the user in your final response.`
    );
  });

  it('returns structured data when the adapter requests JSON', async () => {
    ctx.format = 'json';

    await expect(createReview()).resolves.toEqual({
      reviewUrl: 'http://localhost:6006/?path=/review/',
    });
    expect(setReview).toHaveBeenCalledWith(input);
  });
});
