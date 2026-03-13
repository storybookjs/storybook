# Storybook MCP

Reusable MCP package for Storybook component and docs knowledge.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).

## Self-hosting `@storybook/mcp`

### Prerequisites

- Node.js 20+
- A [manifests](https://storybook.js.org/docs/next/ai/manifests) source containing:
  - `components.json` (required)
  - `docs.json` (optional)

### Example implementation

Reference implementation: [apps/self-host-mcp/server.ts](../../apps/self-host-mcp/server.ts)

The example repo demonstrates self-hosting patterns for both a Node.js process and a Netlify Function.

#### Minimal implementation

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

#### With custom manifest source

Use `manifestProvider` when your manifests are not available from the same origin/path layout:

```ts
const storybookMcpHandler = await createStorybookMcpHandler({
	manifestProvider: async (_request, path) => {
		return asyncReadManifestFromSomewhere(path);
	},
});
```

### API reference

#### `createStorybookMcpHandler`

Type:

```ts
(options?: StorybookMcpHandlerOptions) => Promise<Handler>;

type Handler = (req: Request, context?: StorybookContext) => Promise<Response>;
```

Creates and configures an MCP HTTP handler with all built-in docs tools registered.

##### Parameters

###### `options`

Type: [`StorybookMcpHandlerOptions`](#handler-options-and-request-context)

Default: `{}`

Server-level configuration. The handler uses this at creation time and as a fallback for per-request context.

##### Returns

Type: `Promise<Handler>`

A fetch-compatible request handler for your `/mcp` endpoint.

##### Behavior

- Registers these MCP tools:
  - [`list-all-documentation`](https://storybook.js.org/docs/next/ai/mcp/overview/#list-all-documentation)
  - [`get-documentation`](https://storybook.js.org/docs/next/ai/mcp/overview/#get-documentation)
  - [`get-documentation-for-story`](https://storybook.js.org/docs/next/ai/mcp/overview/#get-documentation-for-story)
- Uses HTTP transport from [`@tmcp/transport-http`](https://github.com/paoloricciuti/tmcp/).
- For each request, the handler always passes the current `Request` as `context.request`.
- Per-request `context` overrides handler-level `options` for:
  - [`manifestProvider`](#manifestprovider)
  - [`onListAllDocumentation`](#onlistalldocumentation)
  - [`onGetDocumentation`](#ongetdocumentation)

> Note: [`onSessionInitialize`](#handler-options-and-request-context) can only be set at handler creation time (in `options`).

##### Example

```ts
import { createStorybookMcpHandler } from '@storybook/mcp';

const mcp = await createStorybookMcpHandler({
	manifestProvider: async (_request, path) => {
		return await fetchManifest(path);
	},
});

export async function handleRequest(request: Request) {
	if (new URL(request.url).pathname !== '/mcp') {
		return new Response('Not found', { status: 404 });
	}

	return mcp(request);
}
```

#### Handler options and request context

`@storybook/mcp` uses the same core fields in two places:

- Handler creation (`createStorybookMcpHandler(options)`)
- Per-request override (`handler(request, context)`)

Type:

```ts
type StorybookContext = {
	request?: Request;
	manifestProvider?: (
		request: Request | undefined,
		path: string,
		source?: Source,
	) => Promise<string>;
	sources?: Source[];
	onListAllDocumentation?: (params: {
		context: StorybookContext;
		manifests: AllManifests;
		resultText: string;
		sources?: SourceManifests[];
	}) => void | Promise<void>;
	onGetDocumentation?: (
		params:
			| {
					context: StorybookContext;
					input: { id: string; storybookId?: string };
					foundDocumentation: ComponentManifest | Doc;
					resultText: string;
			  }
			| {
					context: StorybookContext;
					input: { id: string; storybookId?: string };
			  },
	) => void | Promise<void>;
};

type StorybookMcpHandlerOptions = StorybookContext & {
	onSessionInitialize?: (initializeRequestParams: InitializeRequestParams) => void | Promise<void>;
};
```

> [!NOTE]
> `onSessionInitialize` is only used when provided at handler creation time (`createStorybookMcpHandler(options)`). It is ignored in per-request `context`.
>
> `InitializeRequestParams` is the [`tmcp`](https://github.com/paoloricciuti/tmcp/) initialize payload type, and its exact structure may change in patch versions. Prefer treating it as an opaque protocol payload unless you need specific fields.

##### `manifestProvider`

Type:

```ts
(request: Request | undefined, path: string, source?: Source) => Promise<string>;
```

Primary extension point for production setups.

Use this when manifests are not available at the default same-origin paths. Your function returns the raw JSON string for each requested manifest path.

For a real customization example (switching between HTTP and filesystem-backed manifest loading), see the [Example implementation](#example-implementation) section above.

Manifest paths requested by built-in tools:

- `./manifests/components.json` (required)
- `./manifests/docs.json` (optional)

##### `request`

Type: `Request`

The incoming HTTP request for the current call, as a Web Fetch API (`WHATWG`) `Request`.

This is **not** a Node.js `http.IncomingMessage`. In Node runtimes, pass a fetch-compatible `Request` (for example, Node's global `Request` from Undici in modern Node versions), or convert your server's native request object before calling the handler.

`createStorybookMcpHandler` automatically sets this field when you invoke the returned handler with `(request, context?)`.

##### `onListAllDocumentation`

Type:

```ts
(params: {
  context: StorybookContext;
  manifests: AllManifests;
  resultText: string;
  sources?: SourceManifests[];
}) => void | Promise<void>
```

Optional callback after `list-all-documentation` resolves successfully.

##### `onGetDocumentation`

Type:

```ts
(
  params:
    | {
        context: StorybookContext;
        input: { id: string; storybookId?: string };
        foundDocumentation: ComponentManifest | Doc;
        resultText: string;
      }
    | {
        context: StorybookContext;
        input: { id: string; storybookId?: string };
      },
) => void | Promise<void>
```

Optional callback after `get-documentation` runs:

- When a component/docs entry is found, receives `foundDocumentation` and `resultText`.
- When not found, receives only `context` and `input`.

##### `sources`

Type: `Source[]`

Optional multi-source configuration for composing multiple Storybook MCP sources. This is supported but relatively uncommon for most user setups.

#### `Source`

Type:

```ts
type Source = {
	id: string;
	title: string;
	url?: string;
};
```

Represents one Storybook source in multi-source mode.

#### `SourceManifests`

Type:

```ts
type SourceManifests = {
	source: Source;
	componentManifest: ComponentManifestMap;
	docsManifest?: DocsManifestMap;
	error?: string;
};
```

Represents fetched manifests (or an error) for a single source.

#### Tool registration exports

Use these when you want to build your own [`tmcp`](https://github.com/paoloricciuti/tmcp/) server instead of using `createStorybookMcpHandler`, while still reusing Storybook's docs tools.

This approach is useful when you need to:

- register Storybook tools alongside your own custom tools,
- customize transport/session setup yourself,
- or conditionally enable tools based on your own server context.

> [!IMPORTANT]
> These composition helpers are built for `tmcp`'s `McpServer` and **cannot** be directly composed into a server built with the [official MCP TypeScript SDK (`@modelcontextprotocol/sdk`)](https://github.com/modelcontextprotocol/typescript-sdk).

Minimal composition example:

```ts
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import {
	addGetStoryDocumentationTool,
	addGetDocumentationTool,
	addListAllDocumentationTool,
	type StorybookContext,
} from '@storybook/mcp';

const adapter = new ValibotJsonSchemaAdapter();
const server = new McpServer(
	{ name: 'custom-mcp', version: '1.0.0' },
	{
		adapter,
		capabilities: {
			tools: { listChanged: true },
		},
	},
).withContext<StorybookContext>();

await addListAllDocumentationTool(server);
await addGetDocumentationTool(server);
await addGetStoryDocumentationTool(server);
```

After registration, wire your own transport and pass `StorybookContext` per request so tools can resolve manifests (`request`, `manifestProvider`, and optional `sources`).

#### `addListAllDocumentationTool`

Type:

```ts
(server: McpServer<any, StorybookContext>, enabled?: () => boolean | Promise<boolean>) =>
	Promise<void>;
```

Registers the [list tool](https://storybook.js.org/docs/next/ai/mcp/overview/#list-all-documentation) that returns all component/docs IDs from manifests.

#### `addGetDocumentationTool`

Type:

```ts
(
	server: McpServer<any, StorybookContext>,
	enabled?: () => boolean | Promise<boolean>,
	options?: { multiSource?: boolean },
) => Promise<void>;
```

Registers [documentation lookup](https://storybook.js.org/docs/next/ai/mcp/overview/#get-documentation) by component/docs `id`.

When `options.multiSource` is `true`, the tool schema requires `storybookId` input.

#### `addGetStoryDocumentationTool`

Type:

```ts
(
	server: McpServer<any, StorybookContext>,
	enabled?: () => boolean | Promise<boolean>,
	options?: { multiSource?: boolean },
) => Promise<void>;
```

Registers [story-level documentation lookup](https://storybook.js.org/docs/next/ai/mcp/overview/#get-documentation-for-story) for a specific story variant by `componentId` and `storyName`.
