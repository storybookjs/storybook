import preview from './preview.ts';
import Tag from '../../__testfixtures__/csf4-preview-meta/Tag.svelte';

const meta = preview.meta({ component: Tag, args: { label: 'Meta label' } });

export const Default = meta.story();
