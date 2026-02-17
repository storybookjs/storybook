# Storybook MCP (`@storybook/mcp`)

Build your own Storybook-aware MCP server.

`@storybook/mcp` is a framework-agnostic MCP library that exposes tools for component and docs discovery from Storybook manifests. It is the reusable package that powers the docs toolset in `@storybook/addon-mcp`.

## Install

```bash
pnpm add @storybook/mcp
```

## Quick Start

Create an HTTP endpoint that serves MCP requests at `/mcp`:

```ts
import { createStorybookMcpHandler } from '@storybook/mcp';

const storybookMcpHandler = await createStorybookMcpHandler();

export async function handleRequest(req: Request): Promise<Response> {
	if (new URL(req.url).pathname === '/mcp') {
		return storybookMcpHandler(req);
	}

	return new Response('Not found', { status: 404 });
}
```

By default, the handler resolves manifest URLs from the incoming request by replacing `/mcp` with:

- `./manifests/components.json`
- `./manifests/docs.json` (optional)

## Included Tools

- `list-all-documentation`: lists all documented components and standalone docs entries
- `get-documentation`: returns full documentation for a specific id
- `get-documentation-for-story`: returns documentation for a specific story export

## Self-hosting

- Node process example app: [apps/mcp-self-host-node](../../apps/mcp-self-host-node)
- Full guide draft (for storybook.js.org migration): [packages/mcp/docs/self-hosting.md](docs/self-hosting.md)

The Node example is intentionally structured to be transferable to Netlify Functions with small request-routing and deployment config changes.

## Public API

Primary exports:

- `createStorybookMcpHandler(options?)`
- `addListAllDocumentationTool`, `LIST_TOOL_NAME`
- `addGetDocumentationTool`, `GET_TOOL_NAME`
- `addGetComponentStoryDocumentationTool`, `GET_STORY_TOOL_NAME`
- `COMPONENT_MANIFEST_PATH`, `DOCS_MANIFEST_PATH`
- Types: `StorybookContext`, `StorybookMcpHandlerOptions`, `ComponentManifest`, `ComponentManifestMap`

See [packages/mcp/src/index.ts](src/index.ts) for the source of truth and [packages/mcp/docs/self-hosting.md](docs/self-hosting.md) for detailed API docs.
