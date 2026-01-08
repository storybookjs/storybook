import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getManifests, ManifestGetError } from './get-manifest.ts';
import type { ComponentManifestMap, DocsManifestMap } from '../types.ts';

global.fetch = vi.fn();

/**
 * Helper function to create a mock Request object
 */
function createMockRequest(url: string): Request {
	return new Request(url, {
		method: 'POST',
	});
}

/**
 * Helper to create a successful JSON fetch response
 */
function createJsonResponse(data: unknown) {
	return {
		ok: true,
		headers: {
			get: vi.fn().mockReturnValue('application/json'),
		},
		text: vi.fn().mockResolvedValue(JSON.stringify(data)),
	};
}

/**
 * Helper to create a 404 response
 */
function create404Response() {
	return {
		ok: false,
		status: 404,
		statusText: 'Not Found',
	};
}

/**
 * Helper to create a fetch mock that returns different responses based on URL
 */
function createFetchMock(responses: {
	components?: unknown | Error;
	docs?: unknown | Error;
}) {
	return vi.fn().mockImplementation((url: string) => {
		if (url.includes('components.json')) {
			if (responses.components instanceof Error) {
				return Promise.reject(responses.components);
			}
			return Promise.resolve(
				responses.components !== undefined
					? createJsonResponse(responses.components)
					: create404Response(),
			);
		}
		if (url.includes('docs.json')) {
			if (responses.docs instanceof Error) {
				return Promise.reject(responses.docs);
			}
			return Promise.resolve(
				responses.docs !== undefined
					? createJsonResponse(responses.docs)
					: create404Response(),
			);
		}
		return Promise.resolve(create404Response());
	});
}

/**
 * Helper to create a manifestProvider mock that returns different responses based on path
 */
function createManifestProviderMock(responses: {
	components?: string | Error;
	docs?: string | Error;
}) {
	return vi
		.fn()
		.mockImplementation((_request: Request | undefined, path: string) => {
			if (path.includes('components.json')) {
				if (responses.components instanceof Error) {
					return Promise.reject(responses.components);
				}
				return responses.components !== undefined
					? Promise.resolve(responses.components)
					: Promise.reject(new Error('Components not found'));
			}
			if (path.includes('docs.json')) {
				if (responses.docs instanceof Error) {
					return Promise.reject(responses.docs);
				}
				return responses.docs !== undefined
					? Promise.resolve(responses.docs)
					: Promise.reject(new Error('Docs not found'));
			}
			return Promise.reject(new Error('Unknown path'));
		});
}

describe('getManifest', () => {
	beforeEach(() => {
		// Reset the fetch mock between tests since we're checking call counts
		vi.mocked(global.fetch).mockClear();
	});

	describe('error cases', () => {
		it('should throw ManifestGetError when request is not provided and using default provider', async () => {
			await expect(getManifests()).rejects.toThrow(ManifestGetError);
			await expect(getManifests()).rejects.toThrow(
				"You must either pass the original request forward to the server context, or set a custom manifestProvider that doesn't need the request",
			);
		});
		it('should throw ManifestGetError when request is undefined and using default provider', async () => {
			await expect(getManifests(undefined)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(undefined)).rejects.toThrow(
				"You must either pass the original request forward to the server context, or set a custom manifestProvider that doesn't need the request",
			);
		});
		it('should throw ManifestGetError when fetch fails with 404', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(request)).rejects.toThrow(
				'Failed to fetch manifest: 404 Not Found',
			);
		});

		it('should throw ManifestGetError when fetch fails with 500', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(
				'Failed to fetch manifest: 500 Internal Server Error',
			);
		});

		it('should throw ManifestGetError when content type is not JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('text/html'),
				},
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(request)).rejects.toThrow(
				'Invalid content type: expected application/json, got text/html',
			);
		});

		it('should throw ManifestGetError when response is not valid JSON', async () => {
			global.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes('components.json')) {
					return Promise.resolve({
						ok: true,
						headers: {
							get: vi.fn().mockReturnValue('application/json'),
						},
						text: vi.fn().mockResolvedValue('not valid json{'),
					});
				}
				return Promise.resolve(create404Response());
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(request)).rejects.toThrow(
				'Failed to parse component manifest:',
			);
		});

		it('should throw ManifestGetError when manifest schema is invalid', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				text: vi.fn().mockResolvedValue(
					JSON.stringify({
						// Missing required 'v' field
						components: {},
					}),
				),
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects
				.toThrowErrorMatchingInlineSnapshot(`[ManifestGetError: Failed to parse component manifest:
Invalid key: Expected "v" but received undefined]`);
		});

		it('should throw ManifestGetError when components object is empty', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				text: vi.fn().mockResolvedValue(
					JSON.stringify({
						v: 1,
						components: {},
					}),
				),
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(request)).rejects.toThrow(
				'No components found in the manifest',
			);
		});

		it('should wrap network errors in ManifestGetError', async () => {
			global.fetch = vi
				.fn()
				.mockRejectedValue(new Error('Network connection failed'));

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifests(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifests(request)).rejects.toThrow(
				'Network connection failed',
			);
		});

		it('should preserve ManifestGetError when already thrown', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			const request = createMockRequest('https://example.com/mcp');
			try {
				await getManifests(request);
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestGetError);
				expect((error as ManifestGetError).url).toBe(
					'https://example.com/manifests/components.json',
				);
			}
		});
	});

	describe('success cases', () => {
		it('should successfully fetch and parse a valid manifest', async () => {
			const validManifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			global.fetch = createFetchMock({ components: validManifest });

			const request = createMockRequest('https://example.com/mcp');
			const result = await getManifests(request);

			expect(result).toEqual({ componentManifest: validManifest });
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(global.fetch).toHaveBeenCalledWith(
				'https://example.com/manifests/components.json',
			);
			expect(global.fetch).toHaveBeenCalledWith(
				'https://example.com/manifests/docs.json',
			);
		});

		it('should successfully fetch and parse both component and docs manifests', async () => {
			const validComponentManifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			const validDocsManifest: DocsManifestMap = {
				v: 1,
				docs: {
					'getting-started': {
						id: 'getting-started',
						name: 'Getting Started',
						title: 'Getting Started Guide',
						path: 'docs/getting-started.mdx',
						content: '# Getting Started\n\nWelcome to our component library.',
					},
				},
			};

			global.fetch = createFetchMock({
				components: validComponentManifest,
				docs: validDocsManifest,
			});

			const request = createMockRequest('https://example.com/mcp');
			const result = await getManifests(request);

			expect(result).toEqual({
				componentManifest: validComponentManifest,
				docsManifest: validDocsManifest,
			});
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('manifestProvider', () => {
		it('should use manifestProvider when provided', async () => {
			const validManifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			const request = createMockRequest('https://example.com/mcp');
			const manifestProvider = createManifestProviderMock({
				components: JSON.stringify(validManifest),
			});

			const result = await getManifests(request, manifestProvider);

			expect(result).toEqual({ componentManifest: validManifest });
			expect(manifestProvider).toHaveBeenCalledTimes(2);
			expect(manifestProvider).toHaveBeenCalledWith(
				request,
				'./manifests/components.json',
			);
			expect(manifestProvider).toHaveBeenCalledWith(
				request,
				'./manifests/docs.json',
			);
			// fetch should not be called when manifestProvider is used
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('should allow manifestProvider to work without request', async () => {
			const validManifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			const manifestProvider = createManifestProviderMock({
				components: JSON.stringify(validManifest),
			});

			const result = await getManifests(undefined, manifestProvider);

			expect(result).toEqual({ componentManifest: validManifest });
			expect(manifestProvider).toHaveBeenCalledTimes(2);
			expect(manifestProvider).toHaveBeenCalledWith(
				undefined,
				'./manifests/components.json',
			);
			// fetch should not be called when manifestProvider is used
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('should fallback to fetch when manifestProvider is not provided', async () => {
			const validManifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			global.fetch = createFetchMock({ components: validManifest });

			const request = createMockRequest('https://example.com/mcp');
			const result = await getManifests(request);

			expect(result).toEqual({ componentManifest: validManifest });
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(global.fetch).toHaveBeenCalledWith(
				'https://example.com/manifests/components.json',
			);
		});

		it('should handle errors from manifestProvider', async () => {
			const request = createMockRequest('https://example.com/mcp');
			const manifestProvider = createManifestProviderMock({
				components: new Error('File not found'),
			});

			await expect(getManifests(request, manifestProvider)).rejects.toThrow(
				ManifestGetError,
			);
			await expect(getManifests(request, manifestProvider)).rejects.toThrow(
				'Failed to get component manifest: File not found',
			);
		});

		it('should handle invalid JSON from manifestProvider', async () => {
			const request = createMockRequest('https://example.com/mcp');
			const manifestProvider = createManifestProviderMock({
				components: 'not valid json{',
			});

			await expect(getManifests(request, manifestProvider)).rejects.toThrow(
				ManifestGetError,
			);
		});
	});
});
