// Adapted from https://github.com/MCP-UI-Org/mcp-ui/blob/fd89e2942eb7148d83245397be0b6ad34ce538b0/sdks/typescript/server/src/adapters/mcp-apps/adapter-runtime.ts
/**
 * Current protocol version - must match LATEST_PROTOCOL_VERSION from ext-apps
 * @see https://github.com/modelcontextprotocol/ext-apps
 */
const LATEST_PROTOCOL_VERSION = '2025-11-21';

import { MCP_APP_SIZE_CHANGED_EVENT, MCP_APP_PARAM } from '../../constants.ts';
import type { PreviewStoriesOutput } from '../preview-stories.ts';
import pkg from '../../../package.json' with { type: 'json' };

interface McpUiHostStyles {
	variables?: Record<string, string | undefined>;
	css?: {
		fonts?: string;
	};
}

interface McpUiHostContext {
	[key: string]: unknown;
	theme?: 'light' | 'dark';
	styles?: McpUiHostStyles;
	displayMode?: 'inline' | 'fullscreen' | 'pip';
	availableDisplayModes?: string[];
	locale?: string;
	timeZone?: string;
	userAgent?: string;
	platform?: 'web' | 'desktop' | 'mobile';
	deviceCapabilities?: {
		touch?: boolean;
		hover?: boolean;
	};
	safeAreaInsets?: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
}

interface McpUiInitializeResult {
	protocolVersion: string;
	hostInfo: {
		name: string;
		version: string;
	};
	hostCapabilities: Record<string, unknown>;
	hostContext: McpUiHostContext;
	[key: string]: unknown;
}

/**
 * MCP Apps SEP protocol method constants
 * These match the `method` field values from @modelcontextprotocol/ext-apps type definitions:
 * - McpUiInitializeRequest: "ui/initialize"
 * - McpUiInitializedNotification: "ui/notifications/initialized"
 * - McpUiToolInputNotification: "ui/notifications/tool-input"
 * - McpUiToolInputPartialNotification: "ui/notifications/tool-input-partial"
 * - McpUiToolResultNotification: "ui/notifications/tool-result"
 * - McpUiHostContextChangedNotification: "ui/notifications/host-context-changed"
 * - McpUiSizeChangedNotification: "ui/notifications/size-changed"
 * - McpUiResourceTeardownRequest: "ui/resource-teardown"
 *
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/src/spec.types.ts
 */
const METHODS = {
	// Lifecycle
	INITIALIZE: 'ui/initialize',
	INITIALIZED: 'ui/notifications/initialized',

	// Tool data (Host -> Guest)
	TOOL_INPUT: 'ui/notifications/tool-input',
	TOOL_INPUT_PARTIAL: 'ui/notifications/tool-input-partial',
	TOOL_RESULT: 'ui/notifications/tool-result',
	TOOL_CANCELLED: 'ui/notifications/tool-cancelled',

	// Context & UI
	HOST_CONTEXT_CHANGED: 'ui/notifications/host-context-changed',
	SIZE_CHANGED: 'ui/notifications/size-changed',
	RESOURCE_TEARDOWN: 'ui/resource-teardown',

	// Standard MCP methods
	TOOLS_CALL: 'tools/call',
	NOTIFICATIONS_MESSAGE: 'notifications/message',
	OPEN_LINK: 'ui/open-link',
	MESSAGE: 'ui/message',
} as const;

type McpMethod = (typeof METHODS)[keyof typeof METHODS];

// Adapted from https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx#transport-layer

let nextId = 1;

function sendHostRequest(
	method: McpMethod,
	params: unknown,
): Promise<McpUiInitializeResult> {
	const id = nextId++;
	const { promise, resolve, reject } =
		Promise.withResolvers<McpUiInitializeResult>();

	window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');

	window.addEventListener('message', function listener(event: MessageEvent) {
		if (event.data?.id !== id) {
			return;
		}
		window.removeEventListener('message', listener);
		if (event.data?.result) {
			resolve(event.data.result);
		} else if (event.data?.error) {
			reject(new Error(String(event.data.error)));
		}
	});
	return promise;
}

function sendHostNotification(method: McpMethod, params: unknown): void {
	window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
}

function onHostNotification<T = unknown>(
	method: McpMethod,
	handler: (params: T) => void,
): void {
	window.addEventListener('message', function listener(event: MessageEvent) {
		if (event.data?.method === method) {
			handler(event.data.params as T);
		}
	});
}

const initializeResult = (await sendHostRequest(METHODS.INITIALIZE, {
	appInfo: {
		name: 'storybook-story-preview',
		version: pkg.version,
	},
	appCapabilities: {},
	protocolVersion: LATEST_PROTOCOL_VERSION,
})) as McpUiInitializeResult;
applyHostStyles(initializeResult?.hostContext);

onHostNotification(METHODS.TOOL_RESULT, loadStoryIframes);
onHostNotification(METHODS.HOST_CONTEXT_CHANGED, applyHostStyles);
sendHostNotification(METHODS.INITIALIZED, {});

// Listen for size messages from Storybook iframes (height only to avoid feedback loops)
window.addEventListener('message', function (event: MessageEvent) {
	if (event.data?.type !== MCP_APP_SIZE_CHANGED_EVENT) {
		return;
	}

	// Find the iframe that sent this message
	const iframes = document.querySelectorAll<HTMLIFrameElement>('.story-iframe');
	let hasResizedIframes = false;
	for (const iframe of iframes) {
		if (iframe.contentWindow === event.source) {
			iframe.style.height = (event.data.height ?? 0) + 'px';
			hasResizedIframes = true;
			break;
		}
	}
	if (hasResizedIframes) {
		resizeApp();
	}
});

function applyHostStyles(hostContext: McpUiHostContext | undefined): void {
	if (hostContext?.theme) {
		document.documentElement.setAttribute('data-theme', hostContext.theme);
	}
	if (!hostContext?.styles?.variables) {
		return;
	}
	for (const [key, value] of Object.entries(hostContext.styles.variables)) {
		if (value) {
			document.documentElement.style.setProperty(key, value);
		}
	}
	resizeApp();
}

function resizeApp(): void {
	console.log('Resizing app to fit content', {
		width: document.body.scrollWidth,
		height: document.body.scrollHeight,
	});
	sendHostNotification(METHODS.SIZE_CHANGED, {
		width: document.body.scrollWidth,
		height: document.body.scrollHeight,
	});
}

function loadStoryIframes(params: {
	structuredContent?: PreviewStoriesOutput;
}): void {
	const stories = params.structuredContent?.stories;

	if (!stories || stories.length === 0) {
		console.warn('No preview URLs found in tool result.');
		return;
	}

	const template = document.getElementById(
		'preview-template',
	) as HTMLTemplateElement;

	for (const storyResult of stories) {
		if ('error' in storyResult) {
			console.warn('Skipping story with error:', storyResult.error);
			continue;
		}
		const clone = template.content.cloneNode(true) as DocumentFragment;
		const article = clone.querySelector('article') as HTMLElement;
		const heading = clone.querySelector('h1') as HTMLHeadingElement;
		const iframe = clone.querySelector('iframe') as HTMLIFrameElement;

		heading.textContent = `${storyResult.title} - ${storyResult.name}`;

		// Set a reasonable default size while waiting for the iframe to report its size
		iframe.style.width = '100%';
		iframe.style.height = '0';

		const iframeSrc = storyResult.previewUrl.replace(
			'/?path=/story/',
			'/iframe.html?id=',
		);
		// Add MCP App param to enable size reporting in Storybook's preview.ts
		const url = new URL(iframeSrc);
		url.searchParams.set(MCP_APP_PARAM, 'true');
		iframe.src = url.toString();

		document.body.appendChild(article);
	}
	resizeApp();
}
