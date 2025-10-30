import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getManifest, ManifestGetError } from './get-manifest';
import type { ComponentManifestMap } from '../types';

global.fetch = vi.fn();

describe('getManifest', () => {
	beforeEach(() => {
		// Reset the fetch mock between tests since we're checking call counts
		vi.mocked(global.fetch).mockClear();
	});

	describe('error cases', () => {
		it('should throw ManifestGetError when url is not provided', async () => {
			await expect(getManifest()).rejects.toThrow(ManifestGetError);
			await expect(getManifest()).rejects.toThrow(
				'The source URL is required, but was not part of the request context nor was a default source for the server set',
			);
		});

		it('should throw ManifestGetError when url is undefined', async () => {
			await expect(getManifest(undefined)).rejects.toThrow(ManifestGetError);
		});

		it('should throw ManifestGetError when fetch fails with 404', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: 404 Not Found');
		});

		it('should throw ManifestGetError when fetch fails with 500', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to fetch manifest: 500 Internal Server Error');
		});

		it('should throw ManifestGetError when content type is not JSON', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				headers: {
					get: vi.fn().mockReturnValue('text/html'),
				},
			});

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(
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

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Failed to get manifest:');
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

			await expect(
				getManifest('https://example.com/manifest.json'),
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

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow('No components found in the manifest');
		});

		it('should wrap network errors in ManifestGetError', async () => {
			global.fetch = vi
				.fn()
				.mockRejectedValue(new Error('Network connection failed'));

			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('https://example.com/manifest.json'),
			).rejects.toThrow('Network connection failed');
		});

		it('should preserve ManifestGetError when already thrown', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			});

			try {
				await getManifest('https://example.com/manifest.json');
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestGetError);
				expect((error as ManifestGetError).url).toBe(
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

			const result = await getManifest('https://example.com/manifest.json');

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
						path: 'src/components/Button.tsx',
						name: 'Button',
						description: 'A button component',
					},
				},
			};

			const manifestProvider = vi
				.fn()
				.mockResolvedValue(JSON.stringify(validManifest));

			const result = await getManifest(
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

			const result = await getManifest('https://example.com/manifest.json');

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
				getManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow(ManifestGetError);
			await expect(
				getManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow('Failed to get manifest: File not found');
		});

		it('should handle invalid JSON from manifestProvider', async () => {
			const manifestProvider = vi.fn().mockResolvedValue('not valid json{');

			await expect(
				getManifest('./fixtures/manifest.json', manifestProvider),
			).rejects.toThrow(ManifestGetError);
		});
	});
});
