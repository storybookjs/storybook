import { describe, it, expect, vi } from 'vitest';
import { findStoryIds } from './find-story-ids.ts';
import type { StoryIndex } from 'storybook/internal/types';
import type { StoryInput } from '../types.ts';

vi.mock('storybook/internal/csf', () => ({
	storyNameFromExport: (exportName: string) => exportName,
}));

vi.mock('storybook/internal/node-logger', () => ({
	logger: {
		debug: vi.fn(),
	},
}));

describe('findStoryIds', () => {
	const mockStoryIndex: StoryIndex = {
		v: 5,
		entries: {
			'button--primary': {
				type: 'story',
				subtype: 'story',
				id: 'button--primary',
				name: 'Primary',
				title: 'Button',
				importPath: './src/Button.stories.tsx',
				tags: ['story'],
			},
			'button--secondary': {
				type: 'story',
				subtype: 'story',
				id: 'button--secondary',
				name: 'Secondary',
				title: 'Button',
				importPath: './src/Button.stories.tsx',
				tags: ['story'],
			},
			'input--default': {
				type: 'story',
				subtype: 'story',
				id: 'input--default',
				name: 'Default',
				title: 'Input',
				importPath: './src/Input.stories.tsx',
				tags: ['story'],
			},
		},
	};

	it('should find a single story by export name', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			id: 'button--primary',
			input: stories[0],
		});
	});

	it('should find multiple stories', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
			{
				exportName: 'Secondary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
			{
				exportName: 'Default',
				absoluteStoryPath: `${process.cwd()}/src/Input.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(3);
		expect(result.map((entry) => (entry as { id: string }).id)).toEqual([
			'button--primary',
			'button--secondary',
			'input--default',
		]);
	});

	it('should return not found for non-existent stories', () => {
		const stories = [
			{
				exportName: 'NonExistent',
				absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { errorMessage: string }).errorMessage).toContain('No story found');
		expect((result[0] as { errorMessage: string }).errorMessage).toContain('NonExistent');
		expect((result[0] as { errorMessage: string }).errorMessage).toContain(
			'did you forget to pass the explicit story name?',
		);
	});

	it('should not include hint when explicit story name is provided but not found', () => {
		const stories = [
			{
				exportName: 'NonExistent',
				explicitStoryName: 'NonExistent',
				absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { errorMessage: string }).errorMessage).not.toContain(
			'did you forget to pass the explicit story name?',
		);
	});

	it('should find story by explicit story name', () => {
		const stories = [
			{
				exportName: 'SomeExport',
				explicitStoryName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { id: string }).id).toBe('button--primary');
	});

	it('should handle mix of found and not found stories', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
			{
				exportName: 'NonExistent',
				absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
			},
			{
				exportName: 'Default',
				absoluteStoryPath: `${process.cwd()}/src/Input.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(3);
		expect((result[0] as { id: string }).id).toBe('button--primary');
		expect((result[1] as { errorMessage: string }).errorMessage).toContain('NonExistent');
		expect((result[2] as { id: string }).id).toBe('input--default');
		expect((result[1]!.input as StoryInput & { exportName: string }).exportName).toBe(
			'NonExistent',
		);
	});

	it('should return empty results for empty input', () => {
		const result = findStoryIds(mockStoryIndex, []);

		expect(result).toHaveLength(0);
	});

	it('should not find story with wrong file path', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/WrongFile.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { errorMessage: string }).errorMessage).toContain('WrongFile.stories.tsx');
	});

	it('should find story by storyId input', () => {
		const stories: StoryInput[] = [
			{
				storyId: 'button--primary',
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { id: string }).id).toBe('button--primary');
	});

	it('should return not found for non-existent storyId input', () => {
		const stories: StoryInput[] = [
			{
				storyId: 'button--does-not-exist',
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { errorMessage: string }).errorMessage).toContain(
			'button--does-not-exist',
		);
	});

	it('should match stories when cwd and absolute path use Windows separators', () => {
		const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(String.raw`C:\repo`);

		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: String.raw`C:\repo\src\Button.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(1);
		expect((result[0] as { id: string }).id).toBe('button--primary');

		cwdSpy.mockRestore();
	});

	it('should preserve output order for mixed found and not found inputs', () => {
		const stories: StoryInput[] = [
			{ storyId: 'button--does-not-exist' },
			{ exportName: 'Primary', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
			{ storyId: 'input--default' },
			{ exportName: 'Missing', absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx` },
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result).toHaveLength(4);
		expect((result[0] as { errorMessage: string }).errorMessage).toContain(
			'button--does-not-exist',
		);
		expect((result[1] as { id: string }).id).toBe('button--primary');
		expect((result[2] as { id: string }).id).toBe('input--default');
		expect((result[3] as { errorMessage: string }).errorMessage).toContain('Missing');
	});
});
