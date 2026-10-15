import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  OpenServiceUnknownStoryIdsError,
} from '../../../../server-errors.ts';
import {
  invokeToolsetMethod,
  resolveToolsetDescription,
  type ToolsetCtx,
} from '../../toolset-definition.ts';
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
  return invokeToolsetMethod(
    reviewToolset,
    'create',
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
  it('reports what the published review contains', async () => {
    const outcome = await createReview();

    expect(outcome.telemetry).toEqual({
      toolset: 'review',
      tool: 'create',
      event: 'tool:review_create',
      payload: { collectionCount: 1, storyCount: 1, changedFileCount: 1 },
    });
  });

  it('publishes the review and returns its page URL plus what it contains', async () => {
    const outcome = await createReview();

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
      reviewUrl,
      collectionCount: 1,
      storyCount: 1,
      instructions: expect.stringContaining(
        `Open ${reviewUrl} in your in-app browser now, as your very next step.`
      ),
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
1. **Open ${reviewUrl} in your in-app browser now, as your very next step.** Look through your tools and skills, including ones you still have to load, for one that opens a URL in this app's own browser pane or preview tab (a navigate, open-URL or preview tool or skill), not a headless or external browser. Reading a skill does not open the page, also when you read it earlier: run the code it gives you until the browser has navigated to this URL, and run nothing else in between, not even \`git status\`. Write your final response only after that. Skip this only when you have no such tool.
2. **Once the page is open, show the link to the user too.** End your final response with these three lines, unchanged, and put nothing after them:

## 👀 Review your changes
The review shows the 1 story most relevant for you to review right now. Because this is AI-curated, results may be inaccurate or incomplete.
👉 [Open the Storybook review page](${reviewUrl})

Now do step 1 first: open ${reviewUrl} in your in-app browser before you write your final response. The user still needs the link above in that response.`);
    });
  });

  describe('a browse review, which changed no files', () => {
    it('titles the review section after the stories the user asked to see', async () => {
      const outcome = await createReview({ changedFiles: [] }, mcpCtx);

      expect(outcome.markdown).toContain(`## 👀 See the stories
The review shows the 1 story you asked to see. Because this is AI-curated, results may be inaccurate or incomplete.
👉 [Open the Storybook review page](${reviewUrl})`);
      expect(outcome.markdown).not.toContain('Review your changes');
    });
  });

  describe('description', () => {
    it('names the discovery tools the way an MCP client calls them', () => {
      const description = resolveToolsetDescription(
        reviewToolset.methods.create.description,
        mcpCtx
      );

      expect(description).toContain('Start from stories-changed;');
      expect(description).toContain('fall back to stories-find-by-component if');
    });

    it('names the discovery tools as CLI commands', () => {
      const description = resolveToolsetDescription(
        reviewToolset.methods.create.description,
        cliCtx
      );

      expect(description).toContain('Start from npx storybook tools stories changed;');
      expect(description).toContain(
        'fall back to npx storybook tools stories find-by-component if'
      );
    });
  });

  it('names no harness-specific browser tool in its description or result', async () => {
    const description = resolveToolsetDescription(reviewToolset.methods.create.description, mcpCtx);
    const outcome = await createReview({}, mcpCtx);

    for (const harnessTool of [
      'preview_eval',
      'preview_start',
      'Claude_Browser',
      'browser_navigate',
      'node_repl',
    ]) {
      expect(description).not.toContain(harnessTool);
      expect(outcome.markdown).not.toContain(harnessTool);
    }
  });
});
