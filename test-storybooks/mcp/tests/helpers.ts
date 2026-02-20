import { x } from 'tinyexec';

export const STORYBOOK_DIR = new URL('..', import.meta.url).pathname;

export function createMCPRequestBody(method: string, params: any = {}, id: number = 1) {
	return {
		jsonrpc: '2.0',
		id,
		method,
		params,
	};
}

export async function parseMCPResponse(response: Response) {
	const text = await response.text();
	const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
	const jsonText = dataLine!.replace(/^data: /, '').trim();
	return JSON.parse(jsonText);
}

export async function waitForMcpEndpoint(
	endpoint: string,
	options: { maxAttempts?: number; interval?: number; acceptStatuses?: number[] } = {},
): Promise<void> {
	const { maxAttempts = 120, interval = 500, acceptStatuses = [] } = options;
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	let attempts = 0;

	const intervalId = setInterval(async () => {
		attempts++;
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});
			if (response.ok || acceptStatuses.includes(response.status)) {
				clearInterval(intervalId);
				resolve();
				return;
			}
		} catch {
			// Server not ready yet
		}

		if (attempts >= maxAttempts) {
			clearInterval(intervalId);
			reject(new Error('MCP endpoint failed to start within the timeout period'));
		}
	}, interval);

	return promise;
}

export async function killPort(port: number): Promise<void> {
	try {
		if (process.platform === 'win32') {
			await x('npx', ['kill-port', String(port)]);
		} else {
			const { stdout } = await x('lsof', ['-ti', `:${port}`]);
			if (stdout.trim()) {
				await x('kill', ['-9', ...stdout.trim().split('\n')]);
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	} catch {
		// No process on port, continue
	}
}

export function startStorybook(configDir: string, port: number): ReturnType<typeof x> {
	return x('pnpm', ['storybook', '--config-dir', configDir, '--port', String(port)], {
		nodeOptions: {
			cwd: STORYBOOK_DIR,
		},
	});
}

export async function stopStorybook(storybookProcess: ReturnType<typeof x> | null): Promise<void> {
	if (!storybookProcess || !storybookProcess.process) {
		return;
	}
	const kill = Promise.withResolvers<void>();
	storybookProcess.process.on('exit', kill.resolve);
	storybookProcess.kill('SIGTERM');
	await kill.promise;
}
