import { describe, it, expect } from 'vitest';
import { adaptCoreComponent, adaptCoreDoc, adaptCoreStories } from './adapt-core-manifest.ts';
import type { CoreDocgenComponent } from '../types.ts';

describe('adaptCoreStories', () => {
	it('maps a story-docs record into a Story[]', () => {
		expect(
			adaptCoreStories({
				'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
				'button--secondary': { id: 'button--secondary', name: 'Secondary' },
			}),
		).toEqual([
			{ id: 'button--primary', name: 'Primary', snippet: '<Button />' },
			{ id: 'button--secondary', name: 'Secondary' },
		]);
	});

	it('returns an already-resolved array unchanged', () => {
		const stories = [{ name: 'Primary', snippet: '<Button />' }];
		expect(adaptCoreStories(stories)).toBe(stories);
	});

	it('returns undefined when there are no stories', () => {
		expect(adaptCoreStories(undefined)).toBeUndefined();
	});
});

describe('adaptCoreDoc', () => {
	it('keeps optional fields when present and omits them otherwise', () => {
		expect(
			adaptCoreDoc({ id: 'intro', name: 'Intro', title: 'Introduction', content: '# Hi' }),
		).toEqual({ id: 'intro', name: 'Intro', title: 'Introduction', content: '# Hi' });

		expect(adaptCoreDoc({ id: 'intro', name: 'Intro' })).toEqual({ id: 'intro', name: 'Intro' });
	});
});

describe('adaptCoreComponent', () => {
	it('passes reactComponentMeta through and drops argTypes', () => {
		const core: CoreDocgenComponent = {
			id: 'button',
			name: 'Button',
			path: 'src/Button.tsx',
			reactComponentMeta: { props: { label: { type: { name: 'string' }, required: true } } },
			argTypes: { label: { control: 'text' } },
		};

		const result = adaptCoreComponent(core);

		expect(result.reactComponentMeta).toEqual(core.reactComponentMeta);
		expect('argTypes' in result).toBe(false);
		expect(result.path).toBe('src/Button.tsx');
	});

	it('maps the story-docs record and attached docs into the internal shape', () => {
		const core: CoreDocgenComponent = {
			id: 'button',
			name: 'Button',
			stories: {
				'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
			},
			import: "import { Button } from './Button'",
			docs: {
				'button--docs': { id: 'button--docs', name: 'Docs', title: 'Button', content: '# Button' },
			},
		};

		const result = adaptCoreComponent(core);

		expect(result.stories).toEqual([
			{ id: 'button--primary', name: 'Primary', snippet: '<Button />' },
		]);
		expect(result.import).toBe("import { Button } from './Button'");
		expect(result.docs).toEqual({
			'button--docs': { id: 'button--docs', name: 'Docs', title: 'Button', content: '# Button' },
		});
	});

	it('keeps subcomponents (incl. their reactComponentMeta) intact', () => {
		const core: CoreDocgenComponent = {
			id: 'button',
			name: 'Button',
			subcomponents: {
				Icon: { name: 'Icon', path: 'src/Icon.tsx', reactComponentMeta: { props: {} } },
			},
		};

		const result = adaptCoreComponent(core);
		expect(result.subcomponents).toEqual(core.subcomponents);
	});
});
