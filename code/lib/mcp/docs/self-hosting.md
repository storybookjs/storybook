# Self-hosting `@storybook/mcp`

This document is a draft for migration into the Storybook docs site.

It covers:

1. Running `@storybook/mcp` in a Node.js process
2. Minor changes to deploy the same approach to Netlify Functions
3. API reference for all public exports

## What `@storybook/mcp` is

`@storybook/mcp` is a library that creates an MCP server exposing Storybook component/docs knowledge from manifests.

The server exposes three tools:

- `list-all-documentation`
- `get-documentation`
- `get-documentation-for-story`

## Prerequisites

- Node.js 20+ (24+ recommended in this monorepo)
- A manifest source containing:
  - `components.json` (required)
  - `docs.json` (optional)

The default manifest paths are:

- `./manifests/components.json`
- `./manifests/docs.json`

## Node.js self-hosting (primary path)

Reference implementation: [apps/mcp-self-host-node/server.js](../../../apps/mcp-self-host-node/server.js)

### Minimal implementation

```ts
import { createStorybookMcpHandler } from '@storybook/mcp';

const storybookMcpHandler = await createStorybookMcpHandler();

export async function handleRequest(request: Request): Promise<Response> {
	if (new URL(request.url).pathname === '/mcp') {
		return storybookMcpHandler(request);
	}

	return new Response('Not found', { status: 404 });
}
```

### With custom manifest source

Use `manifestProvider` when your manifests are not available from the same origin/path layout:

```ts
const storybookMcpHandler = await createStorybookMcpHandler({
	format: 'markdown',
	manifestProvider: async (_request, path) => {
		const fileName = path.split('/').at(-1);
		return readManifestFromSomewhere(fileName);
	},
});
```

### Run the example app

```bash
pnpm install
pnpm --filter @storybook/mcp-self-host-node dev
```

Then connect your MCP client to `http://localhost:13316/mcp`.

## Deploying the same setup to Netlify Functions

The Node example transfers directly to Netlify Functions with minor changes:

1. Export a Netlify function handler instead of starting a local HTTP server.
2. Route function requests so the MCP endpoint path maps to your function URL.
3. Keep `createStorybookMcpHandler(...)` and `manifestProvider` logic unchanged.

### Netlify function shape (illustrative)

```ts
import { createStorybookMcpHandler } from '@storybook/mcp';

const storybookMcpHandler = await createStorybookMcpHandler({
	format: 'markdown',
	manifestProvider: async (_request, path) => {
		return await fetchManifest(path);
	},
});

export default async (request: Request): Promise<Response> => {
	// Ensure your Netlify routing maps this function to /mcp (or adapt this check)
	if (new URL(request.url).pathname !== '/mcp') {
		return new Response('Not found', { status: 404 });
	}

	return await storybookMcpHandler(request);
};
```

### Netlify-specific notes

- If manifests are deployed as static assets, `manifestProvider` can fetch from those URLs.
- If manifests are stored externally (S3, blob storage, API), keep that lookup in `manifestProvider`.
- Keep an eye on function timeout/size limits if your manifest payloads are very large.

## API reference

Source of truth: [packages/mcp/src/index.ts](../src/index.ts), [packages/mcp/src/types.ts](../src/types.ts)

### `createStorybookMcpHandler(options?)`

Creates and configures an MCP HTTP transport handler.

Signature:

```ts
createStorybookMcpHandler(options?: StorybookMcpHandlerOptions): Promise<Handler>

type Handler = (req: Request, context?: StorybookContext) => Promise<Response>;
```

Behavior:

- Registers all built-in docs tools.
- Returns a request handler you can call from any fetch-compatible server runtime.
- Merges per-request `context` over handler-level `options` for:
  - `format`
  - `manifestProvider`
  - `onListAllDocumentation`
  - `onGetDocumentation`

### `StorybookMcpHandlerOptions`

Extends `StorybookContext` with:

- `onSessionInitialize?`: called when an MCP session is initialized.

### `StorybookContext`

Context passed into each request:

- `request?: Request`
- `format?: 'markdown' | 'xml'`
- `manifestProvider?: (request: Request | undefined, path: string) => Promise<string>`
- `onListAllDocumentation?`
- `onGetDocumentation?`

### Tool exports

- `addListAllDocumentationTool`, `LIST_TOOL_NAME`
- `addGetDocumentationTool`, `GET_TOOL_NAME`
- `addGetComponentStoryDocumentationTool`, `GET_STORY_TOOL_NAME`

Use these when you want to compose your own `tmcp` server but still reuse Storybook docs tools.

### Manifest path exports

- `COMPONENT_MANIFEST_PATH` (`./manifests/components.json`)
- `DOCS_MANIFEST_PATH` (`./manifests/docs.json`)

### Type exports

- `StorybookContext`
- `ComponentManifest`
- `ComponentManifestMap`

## Suggested docs-site structure (for migration)

When copying this draft into storybook.js.org docs, split into:

1. Overview + quickstart
2. Self-host on Node
3. Deploy to serverless (Netlify Functions adaptation)
4. API reference
