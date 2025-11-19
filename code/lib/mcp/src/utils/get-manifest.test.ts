import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getManifest, ManifestGetError } from './get-manifest';
import type { ComponentManifestMap } from '../types';

global.fetch = vi.fn();

/**
 * Helper function to create a mock Request object
 */
function createMockRequest(url: string): Request {
	return new Request(url, {
		method: 'POST',
	});
}

describe('getManifest', () => {
	beforeEach(() => {
		// Reset the fetch mock between tests since we're checking call counts
		vi.mocked(global.fetch).mockClear();
	});

	describe('error cases', () => {
		it('should throw ManifestGetError when request is not provided and using default provider', async () => {
			await expect(getManifest()).rejects.toThrow(ManifestGetError);
			await expect(getManifest()).rejects.toThrow(
				"You must either pass the original request forward to the server context, or set a custom manifestProvider that doesn't need the request",
			);
		});
		it('should throw ManifestGetError when request is undefined and using default provider', async () => {
			await expect(getManifest(undefined)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(undefined)).rejects.toThrow(
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
			await expect(getManifest(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(request)).rejects.toThrow(
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
			await expect(getManifest(request)).rejects.toThrow(
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
			await expect(getManifest(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(request)).rejects.toThrow(
				'Invalid content type: expected application/json, got text/html',
			);
		});

		it('should throw ManifestGetError when response is not valid JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				text: vi.fn().mockResolvedValue('not valid json{'),
			});

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifest(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(request)).rejects.toThrow(
				'Failed to get manifest:',
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
			await expect(
				getManifest(request),
			).rejects.toThrowErrorMatchingInlineSnapshot(
				`[ManifestGetError: Failed to get manifest: Invalid key: Expected "v" but received undefined]`,
			);
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
			await expect(getManifest(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(request)).rejects.toThrow(
				'No components found in the manifest',
			);
		});

		it('should wrap network errors in ManifestGetError', async () => {
			global.fetch = vi
				.fn()
				.mockRejectedValue(new Error('Network connection failed'));

			const request = createMockRequest('https://example.com/mcp');
			await expect(getManifest(request)).rejects.toThrow(ManifestGetError);
			await expect(getManifest(request)).rejects.toThrow(
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
				await getManifest(request);
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

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				text: vi.fn().mockResolvedValue(JSON.stringify(validManifest)),
			});

			const request = createMockRequest('https://example.com/mcp');
			const result = await getManifest(request);

			expect(result).toEqual(validManifest);
			expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
				'https://example.com/manifests/components.json',
			);
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
			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(validManifest));

			const result = await getManifest(request, manifestProvider);

			expect(result).toEqual(validManifest);
			expect(manifestProvider).toHaveBeenCalledExactlyOnceWith(
				request,
				'./manifests/components.json',
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

			// Custom provider that doesn't need the request
			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(validManifest));

			const result = await getManifest(undefined, manifestProvider);

			expect(result).toEqual(validManifest);
			expect(manifestProvider).toHaveBeenCalledExactlyOnceWith(
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

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				text: vi.fn().mockResolvedValue(JSON.stringify(validManifest)),
			});

			const request = createMockRequest('https://example.com/mcp');
			const result = await getManifest(request);

			expect(result).toEqual(validManifest);
			expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
				'https://example.com/manifests/components.json',
			);
		});

		it('should handle errors from manifestProvider', async () => {
			const request = createMockRequest('https://example.com/mcp');
			const manifestProvider = vi
				.fn()
				.mockRejectedValue(new Error('File not found'));

			await expect(getManifest(request, manifestProvider)).rejects.toThrow(
				ManifestGetError,
			);
			await expect(getManifest(request, manifestProvider)).rejects.toThrow(
				'Failed to get manifest: File not found',
			);
		});

		it('should handle invalid JSON from manifestProvider', async () => {
			const request = createMockRequest('https://example.com/mcp');
			const manifestProvider = vi.fn().mockResolvedValue('not valid json{');

			await expect(getManifest(request, manifestProvider)).rejects.toThrow(
				ManifestGetError,
			);
		});
	});
});
