import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findStoryIds } from './find-story-ids.ts';
import type { StoryIndex } from 'storybook/internal/types';

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

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should find a single story by export name', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result.found).toHaveLength(1);
		expect(result.found[0]!.id).toBe('button--primary');
		expect(result.found[0]!.input).toEqual(stories[0]);
		expect(result.notFound).toHaveLength(0);
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

		expect(result.found).toHaveLength(3);
		expect(result.found.map((f) => f.id)).toEqual([
			'button--primary',
			'button--secondary',
			'input--default',
		]);
		expect(result.notFound).toHaveLength(0);
	});

	it('should return not found for non-existent stories', () => {
		const stories = [
			{
				exportName: 'NonExistent',
				absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result.found).toHaveLength(0);
		expect(result.notFound).toHaveLength(1);
		expect(result.notFound[0]!.errorMessage).toContain('No story found');
		expect(result.notFound[0]!.errorMessage).toContain('NonExistent');
		expect(result.notFound[0]!.errorMessage).toContain(
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

		expect(result.notFound).toHaveLength(1);
		expect(result.notFound[0]!.errorMessage).not.toContain(
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

		expect(result.found).toHaveLength(1);
		expect(result.found[0]!.id).toBe('button--primary');
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

		expect(result.found).toHaveLength(2);
		expect(result.found.map((f) => f.id)).toEqual(['button--primary', 'input--default']);
		expect(result.notFound).toHaveLength(1);
		expect(result.notFound[0]!.input.exportName).toBe('NonExistent');
	});

	it('should return empty results for empty input', () => {
		const result = findStoryIds(mockStoryIndex, []);

		expect(result.found).toHaveLength(0);
		expect(result.notFound).toHaveLength(0);
	});

	it('should not find story with wrong file path', () => {
		const stories = [
			{
				exportName: 'Primary',
				absoluteStoryPath: `${process.cwd()}/src/WrongFile.stories.tsx`,
			},
		];

		const result = findStoryIds(mockStoryIndex, stories);

		expect(result.found).toHaveLength(0);
		expect(result.notFound).toHaveLength(1);
	});
});
