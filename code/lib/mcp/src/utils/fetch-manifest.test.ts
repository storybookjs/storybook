import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchManifest, ManifestFetchError } from './fetch-manifest';
import type { ComponentManifestMap } from '../types';

global.fetch = vi.fn();

describe('fetchManifest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('error cases', () => {
		it('should throw ManifestFetchError when url is not provided', async () => {
			await expect(fetchManifest()).rejects.toThrow(ManifestFetchError);
			await expect(fetchManifest()).rejects.toThrow(
				'The source URL is required, but was not part of the request context nor was a default source for the server set',
			);
		});

		it('should throw ManifestFetchError when url is undefined', async () => {
			await expect(fetchManifest(undefined)).rejects.toThrow(
				ManifestFetchError,
			);
		});

		it('should throw ManifestFetchError when fetch fails with 404', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: 404 Not Found');
		});

		it('should throw ManifestFetchError when fetch fails with 500', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: 500 Internal Server Error');
		});

		it('should throw ManifestFetchError when content type is not JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('text/html'),
				},
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(
				'Invalid content type: expected application/json, got text/html',
			);
		});

		it('should throw ManifestFetchError when response is not valid JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: Invalid JSON');
		});

		it('should throw ManifestFetchError when manifest schema is invalid', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				json: vi.fn().mockResolvedValue({
					// Missing required 'v' field
					components: {},
				}),
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrowErrorMatchingInlineSnapshot(
				`[ManifestFetchError: Failed to fetch manifest: Invalid key: Expected "v" but received undefined]`,
			);
		});

		it('should throw ManifestFetchError when components object is empty', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				json: vi.fn().mockResolvedValue({
					v: 1,
					components: {},
				}),
			});

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow('No components found in the manifest');
		});

		it('should wrap network errors in ManifestFetchError', async () => {
			global.fetch = vi
				.fn()
				.mockRejectedValue(new Error('Network connection failed'));

			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: Network connection failed');
		});

		it('should preserve ManifestFetchError when already thrown', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			try {
				await fetchManifest('https://example.com/manifest.json');
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestFetchError);
				expect((error as ManifestFetchError).url).toBe(
					'https://example.com/manifest.json',
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
				json: vi.fn().mockResolvedValue(validManifest),
			});

			const result = await fetchManifest('https://example.com/manifest.json');

			expect(result).toEqual(validManifest);
			expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
				'https://example.com/manifest.json',
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
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(validManifest));

			const result = await fetchManifest(
				'./fixtures/manifest.json',
				manifestProvider,
			);

			expect(result).toEqual(validManifest);
			expect(manifestProvider).toHaveBeenCalledExactlyOnceWith(
				'./fixtures/manifest.json',
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
				json: vi.fn().mockResolvedValue(validManifest),
			});

			const result = await fetchManifest('https://example.com/manifest.json');

			expect(result).toEqual(validManifest);
			expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
				'https://example.com/manifest.json',
			);
		});

		it('should handle errors from manifestProvider', async () => {
			const manifestProvider = vi
				.fn()
				.mockRejectedValue(new Error('File not found'));

			await expect(
				fetchManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow(ManifestFetchError);
			await expect(
				fetchManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow('Failed to fetch manifest: File not found');
		});

		it('should handle invalid JSON from manifestProvider', async () => {
			const manifestProvider = vi.fn().mockResolvedValue('not valid json{');

			await expect(
				fetchManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow(ManifestFetchError);
		});

		it('should validate manifest from manifestProvider', async () => {
			// Missing required 'v' field
			const invalidManifest = {
				components: {
					button: {
						id: 'button',
						name: 'Button',
					},
				},
			};

			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(invalidManifest));

			await expect(
				fetchManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow(ManifestFetchError);
		});

		it('should throw when manifest from manifestProvider has no components', async () => {
			const emptyManifest = {
				v: 1,
				components: {},
			};

			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(emptyManifest));

			await expect(
				fetchManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow('No components found in the manifest');
		});
	});
});
