import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { ApiCtx } from '../../../public-api/index.ts';
import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import { reviewApi } from './api.ts';

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
let ctx: ApiCtx;
let serviceError: Error | undefined;

function createReview(
  overrides: Partial<v.InferInput<typeof reviewApi.methods.create.schema>> = {}
) {
  return reviewApi.methods.create.handler(
    v.parse(reviewApi.methods.create.schema, { ...input, ...overrides }),
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
      getService: vi.fn(() => ({ commands: { setReview } })) as ApiCtx['getService'],
    };
  });

  it('rejects with a missing-origin error when no server origin is configured', async () => {
    ctx.origin = '';

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
    expect(ctx.getService).toHaveBeenCalledWith('core/review');
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

  it('returns structured data with json true', async () => {
    await expect(createReview({ json: true })).resolves.toEqual({
      reviewUrl: 'http://localhost:6006/?path=/review/',
    });
    expect(setReview).toHaveBeenCalledWith(input);
  });

  it('contains only public API fields', () => {
    expect(Object.keys(reviewApi)).toEqual(['id', 'description', 'methods']);
    expect(Object.keys(reviewApi.methods.create).sort()).toEqual([
      'description',
      'handler',
      'schema',
    ]);
  });
});
