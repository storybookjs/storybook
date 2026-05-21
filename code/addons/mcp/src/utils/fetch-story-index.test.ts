import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStoryIndex } from './fetch-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };

describe('fetchStoryIndex', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		global.fetch = vi.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('should fetch and return story index successfully', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => smallStoryIndexFixture,
		});

		const origin = 'http://localhost:6006';
		const result = await fetchStoryIndex(origin);

		expect(mockFetch).toHaveBeenCalledWith('http://localhost:6006/index.json');
		expect(result).toEqual(smallStoryIndexFixture);
		expect(Object.keys(result.entries)).toHaveLength(3);
	});

	it('should not retry on 404 (non-transient) and include status + statusText in error', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			text: async () => '',
		});

		await expect(
			fetchStoryIndex('http://localhost:6006', { sleep: vi.fn() }),
		).rejects.toThrow(/Failed to fetch story index: 404 Not Found/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('should retry transient 5xx responses up to maxAttempts and succeed on a later attempt', async () => {
		const mockFetch = global.fetch as any;
		mockFetch
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Vite: failed to compile preview.tsx',
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 503,
				statusText: 'Service Unavailable',
				text: async () => '',
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => smallStoryIndexFixture,
			});
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchStoryIndex('http://localhost:6006', {
			maxAttempts: 3,
			baseBackoffMs: 100,
			sleep,
		});

		expect(result).toEqual(smallStoryIndexFixture);
		expect(mockFetch).toHaveBeenCalledTimes(3);
		// Backoff is `attempt * baseBackoffMs` — first wait 100ms, second wait 200ms.
		expect(sleep).toHaveBeenNthCalledWith(1, 100);
		expect(sleep).toHaveBeenNthCalledWith(2, 200);
	});

	it('should give up after maxAttempts of transient errors and include body snippet + attempt count in message', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: async () => 'Vite: failed to compile preview.tsx (export StoreProvider not found)',
		});
		const sleep = vi.fn().mockResolvedValue(undefined);

		await expect(
			fetchStoryIndex('http://localhost:6006', { maxAttempts: 3, baseBackoffMs: 50, sleep }),
		).rejects.toThrow(
			/500 Internal Server Error — Vite: failed to compile preview\.tsx \(export StoreProvider not found\) \(attempt 3\/3, transient — Storybook may be mid-recompile\)/,
		);
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('should not retry on 4xx non-transient codes even with high maxAttempts', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: async () => '',
		});
		const sleep = vi.fn();

		await expect(
			fetchStoryIndex('http://localhost:6006', { maxAttempts: 5, sleep }),
		).rejects.toThrow(/401 Unauthorized.*non-transient — giving up/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('should retry on 429 (too many requests) and 408 (timeout)', async () => {
		const mockFetch = global.fetch as any;
		mockFetch
			.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => '' })
			.mockResolvedValueOnce({ ok: false, status: 408, statusText: 'Request Timeout', text: async () => '' })
			.mockResolvedValueOnce({ ok: true, json: async () => smallStoryIndexFixture });
		const sleep = vi.fn().mockResolvedValue(undefined);

		const result = await fetchStoryIndex('http://localhost:6006', {
			maxAttempts: 3,
			baseBackoffMs: 10,
			sleep,
		});
		expect(result).toEqual(smallStoryIndexFixture);
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('should bubble up network errors (fetch rejection) without retrying', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockRejectedValue(new Error('Network error'));

		await expect(fetchStoryIndex('http://localhost:6006')).rejects.toThrow('Network error');
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('should handle invalid JSON response', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => {
				throw new Error('Invalid JSON');
			},
		});

		await expect(fetchStoryIndex('http://localhost:6006')).rejects.toThrow('Invalid JSON');
	});

	it('truncates very long body snippets in the error message', async () => {
		const longBody = 'x'.repeat(500);
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: async () => longBody,
		});

		try {
			await fetchStoryIndex('http://localhost:6006', { maxAttempts: 1, sleep: vi.fn() });
			throw new Error('expected throw');
		} catch (e) {
			const msg = (e as Error).message;
			// Snippet should be truncated with an ellipsis.
			expect(msg).toMatch(/x{100,200}…/);
			// And the full 500 chars must not be in the message.
			expect(msg).not.toContain(longBody);
		}
	});
});
