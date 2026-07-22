import { describe, it, expect, vi } from 'vitest';
import type { Options, StoryIndex } from 'storybook/internal/types';
import { getStoryIndex } from './get-story-index.ts';

function makeOptions(apply: Options['presets']['apply']): Options {
	return { presets: { apply } } as unknown as Options;
}

const index: StoryIndex = {
	v: 5,
	entries: {
		'button--primary': {
			type: 'story',
			id: 'button--primary',
			name: 'Primary',
			title: 'Button',
			importPath: './Button.stories.tsx',
			tags: [],
		},
	},
} as unknown as StoryIndex;

describe('getStoryIndex', () => {
	it('resolves the index from the storyIndexGenerator preset', async () => {
		const getIndex = vi.fn().mockResolvedValue(index);
		const apply = vi.fn().mockResolvedValue({ getIndex });
		const options = makeOptions(apply as unknown as Options['presets']['apply']);

		const result = await getStoryIndex(options);

		expect(apply).toHaveBeenCalledWith('storyIndexGenerator');
		expect(getIndex).toHaveBeenCalledOnce();
		expect(result).toBe(index);
	});

	it('throws a clear error when the generator preset is unavailable', async () => {
		const apply = vi.fn().mockResolvedValue(undefined);
		const options = makeOptions(apply as unknown as Options['presets']['apply']);

		await expect(getStoryIndex(options)).rejects.toThrow(/story index generator is unavailable/);
	});

	it('propagates errors thrown by the generator', async () => {
		const apply = vi
			.fn()
			.mockResolvedValue({ getIndex: vi.fn().mockRejectedValue(new Error('boom')) });
		const options = makeOptions(apply as unknown as Options['presets']['apply']);

		await expect(getStoryIndex(options)).rejects.toThrow('boom');
	});
});
