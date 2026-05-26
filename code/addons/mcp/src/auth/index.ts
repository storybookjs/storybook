/**
 * Auth module for handling OAuth with composed Storybooks.
 */

export {
	CompositionAuth,
	AuthenticationError,
	STORYBOOK_MCP_PROXY_HEADER,
	extractBearerToken,
	isStorybookMcpProxyRequest,
	type ComposedRef,
	type ManifestProvider,
} from './composition-auth.ts';
