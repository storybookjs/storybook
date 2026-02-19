import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositionAuth, extractBearerToken } from './composition-auth.ts';

describe('CompositionAuth', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('extractBearerToken', () => {
		it('extracts token from valid Bearer header', () => {
			expect(extractBearerToken('Bearer abc123')).toBe('abc123');
		});

		it('returns null for non-Bearer header', () => {
			expect(extractBearerToken('Basic abc123')).toBeNull();
		});

		it('returns null for undefined', () => {
			expect(extractBearerToken(undefined)).toBeNull();
		});

		it('returns null for null', () => {
			expect(extractBearerToken(null)).toBeNull();
		});

		it('extracts token from array header', () => {
			expect(extractBearerToken(['Bearer abc'])).toBe('abc');
		});

		it('finds Bearer in mixed array', () => {
			expect(extractBearerToken(['Basic xyz', 'Bearer abc'])).toBe('abc');
		});

		it('returns null for array without Bearer', () => {
			expect(extractBearerToken(['Basic xyz'])).toBeNull();
		});
	});

	describe('requiresAuth', () => {
		it('returns false when no refs initialized', () => {
			const auth = new CompositionAuth();
			expect(auth.requiresAuth).toBe(false);
		});
	});

	describe('buildWellKnown', () => {
		it('returns null when no auth requirement', () => {
			const auth = new CompositionAuth();
			expect(auth.buildWellKnown('http://localhost:6006')).toBeNull();
		});
	});

	describe('buildWwwAuthenticate', () => {
		it('builds correct header', () => {
			const auth = new CompositionAuth();
			const header = auth.buildWwwAuthenticate('http://localhost:6006');
			expect(header).toContain('Bearer');
			expect(header).toContain('resource_metadata=');
			expect(header).toContain('http://localhost:6006/.well-known/oauth-protected-resource');
		});
	});

	describe('buildSources', () => {
		it('creates sources array with local first', async () => {
			const auth = new CompositionAuth();
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					text: () =>
						Promise.resolve(
							'{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}',
						),
				}),
			);

			await auth.initialize([
				{ id: 'design-system', title: 'Design System', url: 'http://ds.example.com' },
			]);
			const sources = auth.buildSources();

			expect(sources).toEqual([
				{ id: 'local', title: 'Local' },
				{ id: 'design-system', title: 'Design System', url: 'http://ds.example.com' },
			]);
		});

		it('handles multiple refs', async () => {
			const auth = new CompositionAuth();
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					text: () =>
						Promise.resolve(
							'{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}',
						),
				}),
			);

			await auth.initialize([
				{ id: 'ref-a', title: 'Ref A', url: 'http://a.example.com' },
				{ id: 'ref-b', title: 'Ref B', url: 'http://b.example.com' },
			]);
			const sources = auth.buildSources();

			expect(sources).toHaveLength(3);
			expect(sources.map((s) => s.id)).toEqual(['local', 'ref-a', 'ref-b']);
		});

		it('excludes refs without manifests', async () => {
			const auth = new CompositionAuth();
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// ref-a: valid manifest
					.mockResolvedValueOnce({
						ok: true,
						status: 200,
						text: () =>
							Promise.resolve(
								'{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}',
							),
					})
					// ref-b: 404 (no manifest)
					.mockResolvedValueOnce({
						ok: false,
						status: 404,
					})
					// ref-b fallback: /mcp returns 200 (no auth either)
					.mockResolvedValueOnce({
						status: 200,
					}),
			);

			await auth.initialize([
				{ id: 'ref-a', title: 'Ref A', url: 'http://a.example.com' },
				{ id: 'ref-b', title: 'Ref B', url: 'http://b.example.com' },
			]);
			const sources = auth.buildSources();

			expect(sources).toHaveLength(2);
			expect(sources.map((s) => s.id)).toEqual(['local', 'ref-a']);
		});
	});

	describe('createManifestProvider', () => {
		it('creates a manifest provider function', () => {
			const auth = new CompositionAuth();
			const provider = auth.createManifestProvider('http://localhost:6006');
			expect(typeof provider).toBe('function');
		});

		it('fetches from local origin when no source provided', async () => {
			const auth = new CompositionAuth();

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve('{"v":1,"components":{}}'),
			});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');

			await provider(request, './manifests/components.json');

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:6006/manifests/components.json',
				expect.any(Object),
			);
		});

		it('fetches from source URL when source provided', async () => {
			const auth = new CompositionAuth();

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve('{"v":1,"components":{}}'),
			});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await provider(request, './manifests/components.json', source);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://remote.example.com/manifests/components.json',
				expect.any(Object),
			);
		});

		it('extracts token from request headers for auth-required sources', async () => {
			const auth = new CompositionAuth();

			// Initialize with a ref that requires auth (401 → resource metadata → server metadata)
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="http://remote.example.com/.well-known/oauth-protected-resource"',
						}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'http://remote.example.com/mcp',
								authorization_servers: ['http://auth.example.com'],
							}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'http://auth.example.com',
								authorization_endpoint: 'http://auth.example.com/authorize',
								token_endpoint: 'http://auth.example.com/token',
							}),
					}),
			);

			await auth.initialize([{ id: 'remote', title: 'Remote', url: 'http://remote.example.com' }]);

			// Now set up mock for manifest fetching
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve('{"v":1,"components":{}}'),
			});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');

			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer test-token-123' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await provider(request, './manifests/components.json', source);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://remote.example.com/manifests/components.json',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer test-token-123',
					}),
				}),
			);
		});
	});

	describe('fetchManifest (via createManifestProvider)', () => {
		it('returns manifest content when response is valid', async () => {
			const auth = new CompositionAuth();
			const manifestJson =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					text: () => Promise.resolve(manifestJson),
				}),
			);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');

			const result = await provider(request, './manifests/components.json');
			expect(result).toBe(manifestJson);
		});

		it('throws when fetch returns non-ok response', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: false,
					status: 403,
				}),
			);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
				'Failed to fetch',
			);
		});

		it('throws auth error when remote returns 401 directly', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: false,
					status: 401,
				}),
			);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer expired-token' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
				'Authentication failed',
			);
		});

		it('throws auth error when response is invalid manifest and /mcp returns 401', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// First call: manifest fetch returns 200 with unexpected JSON
					.mockResolvedValueOnce({
						ok: true,
						text: () => Promise.resolve('{"some":"unexpected"}'),
					})
					// Second call: /mcp returns 401
					.mockResolvedValueOnce({
						status: 401,
					}),
			);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer invalid-token' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
				'Authentication failed',
			);
		});

		it('throws when response is invalid manifest and /mcp does not return 401', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// First call: manifest fetch returns 200 with unexpected JSON
					.mockResolvedValueOnce({
						ok: true,
						text: () => Promise.resolve('{"some":"unexpected"}'),
					})
					// Second call: /mcp returns 200 (no auth issue)
					.mockResolvedValueOnce({
						status: 200,
					}),
			);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			await expect(provider(request, './manifests/components.json', source)).rejects.toThrow(
				'Invalid manifest response',
			);
		});

		it('caches remote manifest responses and revalidates in background', async () => {
			const auth = new CompositionAuth();
			const manifestJson =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(manifestJson),
			});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer token' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			// First call — fetches (blocking)
			await provider(request, './manifests/components.json', source);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second call — served from cache, triggers background revalidation
			const result = await provider(request, './manifests/components.json', source);
			expect(result).toBe(manifestJson);
			expect(mockFetch).toHaveBeenCalledTimes(2); // background fetch started
		});

		it('fetches fresh when cache is expired', async () => {
			vi.useFakeTimers();
			const auth = new CompositionAuth();
			const oldManifest =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';
			const newManifest =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button","description":"updated"}}}';

			const mockFetch = vi
				.fn()
				.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(oldManifest) })
				.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(newManifest) });
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer token' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			// First call — fetches and caches
			const first = await provider(request, './manifests/components.json', source);
			expect(first).toBe(oldManifest);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Advance time past cache TTL (61 minutes)
			vi.advanceTimersByTime(61 * 60 * 1000);

			// Second call — cache expired, fetches fresh (blocking)
			const second = await provider(request, './manifests/components.json', source);
			expect(second).toBe(newManifest);
			expect(mockFetch).toHaveBeenCalledTimes(2);

			vi.useRealTimers();
		});

		it('does not cache local manifest responses', async () => {
			const auth = new CompositionAuth();
			const manifestJson =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				text: () => Promise.resolve(manifestJson),
			});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp');

			// No source = local
			await provider(request, './manifests/components.json');
			await provider(request, './manifests/components.json');
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('does not cache error responses', async () => {
			const auth = new CompositionAuth();
			const manifestJson =
				'{"v":1,"components":{"button":{"id":"button","path":"src/Button.tsx","name":"Button"}}}';

			const mockFetch = vi
				.fn()
				// First call: fails
				.mockResolvedValueOnce({ ok: false, status: 500 })
				// Second call: succeeds
				.mockResolvedValueOnce({
					ok: true,
					text: () => Promise.resolve(manifestJson),
				});
			vi.stubGlobal('fetch', mockFetch);

			const provider = auth.createManifestProvider('http://localhost:6006');
			const request = new Request('http://localhost:6006/mcp', {
				headers: { Authorization: 'Bearer token' },
			});
			const source = { id: 'remote', title: 'Remote', url: 'http://remote.example.com' };

			// First call fails — should not cache
			await expect(provider(request, './manifests/components.json', source)).rejects.toThrow();

			// Second call should fetch again (not cached)
			const result = await provider(request, './manifests/components.json', source);
			expect(result).toBe(manifestJson);
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('initialize', () => {
		it('detects public refs when manifest returns valid content', async () => {
			const auth = new CompositionAuth();

			// Mock: manifest returns valid manifest JSON
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					status: 200,
					text: () =>
						Promise.resolve(
							'{"v":1,"components":{"button":{"id":"button","name":"Button","path":"src/Button.tsx"}}}',
						),
				}),
			);

			await auth.initialize([{ id: 'public', title: 'public', url: 'http://public.example.com' }]);

			expect(auth.requiresAuth).toBe(false);
			expect(auth.authUrls).toHaveLength(0);
		});

		it('detects private refs via manifest 401 response', async () => {
			const auth = new CompositionAuth();

			// Mock: manifest returns 401, then resource + server metadata
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
						}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://example.com/mcp',
								authorization_servers: ['https://auth.example.com'],
							}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'https://auth.example.com',
								authorization_endpoint: 'https://auth.example.com/authorize',
								token_endpoint: 'https://auth.example.com/token',
							}),
					}),
			);

			await auth.initialize([
				{ id: 'private', title: 'private', url: 'https://private.example.com' },
			]);

			expect(auth.requiresAuth).toBe(true);
			expect(auth.authUrls).toContain('https://private.example.com');

			const wellKnown = auth.buildWellKnown('http://localhost:6006');
			expect(wellKnown).toEqual({
				resource: 'http://localhost:6006/mcp',
				authorization_servers: ['https://auth.example.com'],
				scopes_supported: undefined,
			});
		});

		it('falls back to /mcp when manifest returns unexpected JSON', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// manifest returns 200 with unexpected JSON (not a valid manifest)
					.mockResolvedValueOnce({
						ok: true,
						status: 200,
						text: () => Promise.resolve('{"some":"unexpected","response":true}'),
					})
					// /mcp returns 401
					.mockResolvedValueOnce({
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
						}),
					})
					// resource metadata
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://example.com/mcp',
								authorization_servers: ['https://auth.example.com'],
							}),
					})
					// server metadata
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'https://auth.example.com',
								authorization_endpoint: 'https://auth.example.com/authorize',
								token_endpoint: 'https://auth.example.com/token',
							}),
					}),
			);

			await auth.initialize([
				{ id: 'private', title: 'private', url: 'https://private.example.com' },
			]);

			expect(auth.requiresAuth).toBe(true);
		});

		it('falls back to /mcp when manifest returns non-JSON', async () => {
			const auth = new CompositionAuth();

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// manifest returns 200 with HTML (not JSON)
					.mockResolvedValueOnce({
						ok: true,
						status: 200,
						text: () => Promise.resolve('<html>Login page</html>'),
					})
					// /mcp returns 401
					.mockResolvedValueOnce({
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
						}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://example.com/mcp',
								authorization_servers: ['https://auth.example.com'],
							}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'https://auth.example.com',
								authorization_endpoint: 'https://auth.example.com/authorize',
								token_endpoint: 'https://auth.example.com/token',
							}),
					}),
			);

			await auth.initialize([
				{ id: 'private', title: 'private', url: 'https://private.example.com' },
			]);

			expect(auth.requiresAuth).toBe(true);
		});

		it('warns when refs use different OAuth servers', async () => {
			const auth = new CompositionAuth();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// First ref: manifest returns 401
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://chromatic.com/.well-known/oauth-protected-resource"',
						}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://chromatic.com/mcp',
								authorization_servers: ['https://www.chromatic.com'],
							}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'https://www.chromatic.com',
								authorization_endpoint: 'https://www.chromatic.com/authorize',
								token_endpoint: 'https://www.chromatic.com/token',
							}),
					})
					// Second ref: manifest returns 401 with different server
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://other.example.com/.well-known/oauth-protected-resource"',
						}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://other.example.com/mcp',
								authorization_servers: ['https://other.example.com'],
							}),
					})
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								issuer: 'https://other.example.com',
								authorization_endpoint: 'https://other.example.com/authorize',
								token_endpoint: 'https://other.example.com/token',
							}),
					}),
			);

			await auth.initialize([
				{ id: 'chromatic', title: 'Chromatic', url: 'https://private.chromatic.com' },
				{ id: 'other', title: 'Other', url: 'https://other.example.com' },
			]);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('different OAuth server'));
		});

		it('gracefully skips refs that fail during auth discovery', async () => {
			const auth = new CompositionAuth();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED')));

			await auth.initialize([
				{ id: 'down', title: 'Down Service', url: 'http://unreachable.example.com' },
			]);

			expect(auth.requiresAuth).toBe(false);
			expect(auth.authUrls).toHaveLength(0);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to check auth for composed ref "Down Service"'),
			);
		});

		it('warns when OAuth resource metadata fetch fails', async () => {
			const auth = new CompositionAuth();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// manifest returns 401
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
						}),
					})
					// resource metadata fetch fails
					.mockResolvedValueOnce({
						ok: false,
						status: 503,
					}),
			);

			await auth.initialize([{ id: 'broken', title: 'Broken', url: 'https://broken.example.com' }]);

			expect(auth.requiresAuth).toBe(false);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to fetch OAuth resource metadata'),
			);
		});

		it('warns when OAuth server metadata fetch fails', async () => {
			const auth = new CompositionAuth();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					// manifest returns 401
					.mockResolvedValueOnce({
						ok: false,
						status: 401,
						headers: new Headers({
							'WWW-Authenticate':
								'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
						}),
					})
					// resource metadata succeeds
					.mockResolvedValueOnce({
						ok: true,
						json: () =>
							Promise.resolve({
								resource: 'https://example.com/mcp',
								authorization_servers: ['https://auth.example.com'],
							}),
					})
					// server metadata fails
					.mockResolvedValueOnce({
						ok: false,
						status: 500,
					}),
			);

			await auth.initialize([{ id: 'broken', title: 'Broken', url: 'https://broken.example.com' }]);

			expect(auth.requiresAuth).toBe(false);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to fetch OAuth server metadata'),
			);
		});
	});
});
