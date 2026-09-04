import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  OpenServiceUnknownStoryIdsError,
} from '../../../../server-errors.ts';
import { resolveToolsetDescription, type ToolsetCtx } from '../../toolset-definition.ts';
import { reviewToolset } from './definition.ts';

const reviewUrl = 'http://localhost:6006/?path=/review/';

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
let cliCtx: ToolsetCtx;
let mcpCtx: ToolsetCtx;
let serviceError: Error | undefined;

function createReview(
  overrides: Partial<v.InferInput<typeof reviewToolset.methods.create.input>> = {},
  ctx: ToolsetCtx = cliCtx
) {
  return reviewToolset.methods.create.handler(
    v.parse(reviewToolset.methods.create.input, { ...input, ...overrides }),
    ctx
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceError = undefined;
  setReview.mockImplementation(async () => {
    if (serviceError) {
      throw serviceError;
    }
  });
  cliCtx = {
    transport: 'cli',
    origin: 'http://localhost:6006',
    getService: vi.fn(() => ({ commands: { setReview } })) as ToolsetCtx['getService'],
  };
  mcpCtx = { ...cliCtx, transport: 'mcp' };
});

describe('review.create', () => {
  it('publishes the review and returns its page URL plus what it contains', async () => {
    const outcome = await createReview();

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
      reviewUrl,
      collectionCount: 1,
      storyCount: 1,
    });
    expect(setReview).toHaveBeenCalledWith(input);
    expect(cliCtx.getService).toHaveBeenCalledWith('core/review', { internal: true });
  });

  it('counts stories across every collection', async () => {
    const outcome = await createReview({
      collections: [
        { title: 'Primary', rationale: 'edited', storyIds: ['button--primary', 'button--large'] },
        { title: 'Pages', rationale: 'context', storyIds: ['page--default'] },
      ],
    });

    expect(outcome.data).toMatchObject({ collectionCount: 2, storyCount: 3 });
  });

  it('builds one review URL whether or not the origin ends in a slash', async () => {
    const outcome = await createReview({}, { ...cliCtx, origin: 'http://localhost:6006/' });

    expect(outcome.data).toMatchObject({ reviewUrl });
  });

  it('includes the deployment subpath from the toolset origin in the review link', async () => {
    // A sub-path-hosted Storybook answers MCP under its root; the review page lives there too.
    const outcome = await createReview({}, { ...cliCtx, origin: 'http://localhost:6006/nested' });

    expect(outcome.data).toMatchObject({
      reviewUrl: 'http://localhost:6006/nested/?path=/review/',
    });
  });

  it('rejects when the adapter has no Storybook origin to link to', async () => {
    await expect(createReview({}, { ...cliCtx, origin: undefined })).rejects.toBeInstanceOf(
      OpenServiceMissingOriginError
    );
    expect(setReview).not.toHaveBeenCalled();
  });

  it('propagates service errors unchanged', async () => {
    serviceError = new Error('review service unavailable');

    await expect(createReview()).rejects.toBe(serviceError);
  });

  describe('fabricated story ids', () => {
    beforeEach(() => {
      serviceError = new OpenServiceUnknownStoryIdsError({
        unknownIds: ['button--ghost', 'card--imagined'],
      });
    });

    it('replaces the service error with recovery coaching naming the MCP tools', async () => {
      const error = await createReview({}, mcpCtx).catch((reason: unknown) => reason);

      expect(error).not.toBeInstanceOf(OpenServiceUnknownStoryIdsError);
      expect((error as Error).message)
        .toBe(`Refusing to publish review: 2 story IDs are not backed by a story entry in the live Storybook index (docs entries cannot be review slots):
- \`button--ghost\`
- \`card--imagined\`

This usually means the IDs were inferred from file paths or naming conventions rather than returned by a tool. Resolve real IDs by calling \`stories-find-by-component\` (for components you've edited or want covered) or \`docs-list\` (to browse the index), then retry \`review-create\` with the verified IDs. Do not invent IDs to satisfy this check.`);
    });

    it('names the CLI commands for the CLI transport', async () => {
      const error = await createReview().catch((reason: unknown) => reason);

      expect((error as Error).message).toContain(
        'calling `npx storybook tools stories find-by-component`'
      );
      expect((error as Error).message).toContain('retry `npx storybook tools review create`');
    });

    it('agrees with the singular case', async () => {
      serviceError = new OpenServiceUnknownStoryIdsError({ unknownIds: ['button--ghost'] });

      const error = await createReview().catch((reason: unknown) => reason);

      expect((error as Error).message).toContain(
        'Refusing to publish review: 1 story ID is not backed by a story entry in the live Storybook index (docs entries cannot be review slots)'
      );
    });
  });

  describe('rendering', () => {
    it('renders the same directive for the CLI as for MCP', async () => {
      const outcome = await createReview();
      const mcpOutcome = await createReview({}, mcpCtx);

      expect(outcome.markdown).toContain(`Review applied: 1 collection, 1 story.`);
      expect(outcome.markdown).toBe(mcpOutcome.markdown);
    });

    it('pluralizes the summary', async () => {
      const outcome = await createReview({
        collections: [
          { title: 'Primary', rationale: 'edited', storyIds: ['button--primary'] },
          { title: 'Pages', rationale: 'context', storyIds: ['page--default'] },
        ],
      });

      expect(outcome.markdown).toContain(`Review applied: 2 collections, 2 stories.`);
    });

    it('tells MCP to reuse the request-derived UI root, not the bare origin', async () => {
      // A sub-path-hosted Storybook serves its UI under the request root; "already running at"
      // must name the address the agent can actually reach, like the review link does.
      const outcome = await createReview(
        {},
        {
          ...mcpCtx,
          origin: 'http://localhost:6006/nested',
        }
      );

      expect(outcome.markdown).toContain(
        'Storybook is already running at http://localhost:6006/nested — reuse it.'
      );
    });

    it('tells MCP to open the page itself and to surface the link to the user', async () => {
      const outcome = await createReview({}, mcpCtx);

      expect(outcome.markdown)
        .toBe(`Review applied: 1 collection, 1 story. Storybook is already running at http://localhost:6006 — reuse it. Do NOT start another Storybook or change its port to view this review; the running instance already serves it.

Two things you must do now, both of them:
1. **Open ${reviewUrl} yourself in your preview browser.** If you have any browser-preview or navigate tool in this session (e.g. preview_eval or an equivalent), call it on this URL so the review opens in your preview window immediately. Don't merely print the link and stop — actually open it.
2. **Show the link to the user too.** End your final response with a dedicated review section as the very last thing: its own heading on a line by itself (e.g. \`## 👀 Review your changes\`), then a one-line explanation of what the review is, then on the next line the review page as a markdown link prefixed with a 👉 so it's easy to spot: \`👉 [Open the Storybook review page](${reviewUrl})\`. For the explanation, use something like: "The review shows the 1 story most relevant for you to review right now. Because this is AI-curated, results may be inaccurate or incomplete." Put nothing after the link — not a trailing sentence the user has to hunt for. The user needs to see this link even after you've opened it yourself.`);
    });
  });

  describe('description', () => {
    it('names the discovery tools the way an MCP client calls them', () => {
      const description = resolveToolsetDescription(
        reviewToolset.methods.create.description,
        mcpCtx
      );

      expect(description).toContain('Start from `stories-changed`');
      expect(description).toContain('fall back to `stories-find-by-component`');
    });

    it('names the discovery tools as CLI commands', () => {
      const description = resolveToolsetDescription(
        reviewToolset.methods.create.description,
        cliCtx
      );

      expect(description).toContain('Start from `npx storybook tools stories changed`');
      expect(description).toContain('fall back to `npx storybook tools stories find-by-component`');
    });
  });
});
