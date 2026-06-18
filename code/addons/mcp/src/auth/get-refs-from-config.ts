import type { Options } from 'storybook/internal/types';
import type { ComposedRef } from './composition-auth.ts';

/**
 * Get composed Storybook refs from Storybook config.
 * See: https://storybook.js.org/docs/sharing/storybook-composition
 */
export async function getRefsFromConfig(options: Options): Promise<ComposedRef[]> {
	try {
		const refs = await options.presets.apply('refs', {});

		if (!refs || typeof refs !== 'object') {
			return [];
		}

		return Object.entries(refs as Record<string, { title?: string; url?: string }>)
			.map(([key, value]) => ({
				id: key,
				title: value.title || key,
				url: value.url,
			}))
			.filter((ref): ref is ComposedRef => !!ref.url);
	} catch {
		return [];
	}
}
