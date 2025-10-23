import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchStoryIndex } from './fetch-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };

describe('fetchStoryIndex', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		// Mock fetch globally
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

	it('should throw error on 404 response', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
			statusText: 'Not Found',
		});

		const origin = 'http://localhost:6006';

		await expect(fetchStoryIndex(origin)).rejects.toThrow(
			'Failed to fetch story index: 404 Not Found',
		);
	});

	it('should throw error on network failure', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockRejectedValue(new Error('Network error'));

		const origin = 'http://localhost:6006';

		await expect(fetchStoryIndex(origin)).rejects.toThrow('Network error');
	});

	it('should handle invalid JSON response', async () => {
		const mockFetch = global.fetch as any;
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => {
				throw new Error('Invalid JSON');
			},
		});

		const origin = 'http://localhost:6006';

		await expect(fetchStoryIndex(origin)).rejects.toThrow('Invalid JSON');
	});
});
