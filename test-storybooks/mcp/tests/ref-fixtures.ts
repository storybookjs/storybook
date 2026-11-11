import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type RefFixtures = {
	publicRefUrl: string;
	noManifestRefUrl: string;
	privateRefUrl: string;
	env: Record<string, string>;
	close: () => Promise<void>;
};

type Handler = (req: IncomingMessage, res: ServerResponse, origin: string) => void;

const SCOPES = ['storybook:read', 'project:read'];

const PUBLIC_COMPONENTS_MANIFEST = {
	v: 0,
	components: {
		'example-button': {
			id: 'example-button',
			name: 'Button',
			path: './src/Button.stories.tsx',
			description: 'Button from the composed fixture Storybook',
		},
	},
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(body));
}

function sendNotFound(res: ServerResponse) {
	res.writeHead(404, { 'Content-Type': 'text/plain' });
	res.end('Not found');
}

function pathOf(req: IncomingMessage) {
	return new URL(req.url ?? '/', 'http://fixture').pathname;
}

const publicRef: Handler = (req, res) => {
	switch (pathOf(req)) {
		case '/manifests/components.json':
			return sendJson(res, 200, PUBLIC_COMPONENTS_MANIFEST);
		case '/index.json':
			return sendJson(res, 200, { v: 5, entries: {} });
		default:
			return sendNotFound(res);
	}
};

const noManifestRef: Handler = (req, res) => {
	if (pathOf(req) === '/index.json') {
		return sendJson(res, 200, { v: 5, entries: {} });
	}
	return sendNotFound(res);
};

// Rejects every token, like a private Chromatic Storybook.
const privateRef: Handler = (req, res, origin) => {
	const path = pathOf(req);
	if (path === '/.well-known/oauth-protected-resource') {
		return sendJson(res, 200, {
			resource: `${origin}/mcp`,
			authorization_servers: [origin],
			scopes_supported: SCOPES,
		});
	}
	if (path === '/.well-known/oauth-authorization-server') {
		return sendJson(res, 200, {
			issuer: origin,
			authorization_endpoint: `${origin}/authorize`,
			token_endpoint: `${origin}/token`,
			scopes_supported: SCOPES,
		});
	}
	if (path.startsWith('/manifests/') || path === '/mcp' || path === '/index.json') {
		res.writeHead(401, {
			'Content-Type': 'application/json',
			'WWW-Authenticate': `Bearer error="unauthorized", error_description="Authorization needed", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
		});
		res.end(JSON.stringify({ error: 'unauthorized' }));
		return;
	}
	return sendNotFound(res);
};

async function listen(handler: Handler): Promise<{ url: string; server: Server }> {
	let origin = '';
	const server = createServer((req, res) => handler(req, res, origin));
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return { url: origin, server };
}

export async function startRefFixtures(): Promise<RefFixtures> {
	const [publicFixture, noManifestFixture, privateFixture] = await Promise.all([
		listen(publicRef),
		listen(noManifestRef),
		listen(privateRef),
	]);
	const servers = [publicFixture.server, noManifestFixture.server, privateFixture.server];

	return {
		publicRefUrl: publicFixture.url,
		noManifestRefUrl: noManifestFixture.url,
		privateRefUrl: privateFixture.url,
		env: {
			MCP_TEST_PUBLIC_REF_URL: publicFixture.url,
			MCP_TEST_NO_MANIFEST_REF_URL: noManifestFixture.url,
			MCP_TEST_PRIVATE_REF_URL: privateFixture.url,
		},
		close: async () => {
			await Promise.all(
				servers.map(
					(server) =>
						new Promise<void>((resolve) => {
							server.closeAllConnections();
							server.close(() => resolve());
						}),
				),
			);
		},
	};
}
