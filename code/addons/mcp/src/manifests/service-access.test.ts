import { describe, it, expect, vi, beforeEach } from 'vitest';

// `service-access` caches `getService` at module scope, so each test resets the
// module registry and re-mocks `storybook/internal/core-server` before importing.
beforeEach(() => {
	vi.resetModules();
	vi.doUnmock('storybook/internal/core-server');
});

describe('service-access getService guard', () => {
	it('returns the resolved service when core exports getService', async () => {
		const service = { queries: {} };
		const getService = vi.fn().mockReturnValue(service);
		vi.doMock('storybook/internal/core-server', () => ({ getService }));

		const { getDocgenService } = await import('./service-access.ts');
		await expect(getDocgenService()).resolves.toBe(service);
		expect(getService).toHaveBeenCalledWith('core/docgen');
	});

	it('resolves to undefined on older Storybook without a getService export', async () => {
		vi.doMock('storybook/internal/core-server', () => ({}));

		const { getDocgenService, getStoryDocsService, getMdxService } =
			await import('./service-access.ts');
		await expect(getDocgenService()).resolves.toBeUndefined();
		await expect(getStoryDocsService()).resolves.toBeUndefined();
		await expect(getMdxService()).resolves.toBeUndefined();
	});

	it('resolves to undefined when the service is not registered (getService throws)', async () => {
		const getService = vi.fn(() => {
			throw new Error('service not registered');
		});
		vi.doMock('storybook/internal/core-server', () => ({ getService }));

		const { getMdxService } = await import('./service-access.ts');
		await expect(getMdxService()).resolves.toBeUndefined();
	});

	it('resolves to undefined when the core-server import itself fails', async () => {
		vi.doMock('storybook/internal/core-server', () => {
			throw new Error('module not found');
		});

		const { getDocgenService } = await import('./service-access.ts');
		await expect(getDocgenService()).resolves.toBeUndefined();
	});
});
