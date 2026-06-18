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

		return Object.entries(refs as Record<string, unknown>).flatMap(([key, value]) => {
			if (!value || typeof value !== 'object') {
				return [];
			}

			const { title, url } = value as { title?: unknown; url?: unknown };
			if (typeof url !== 'string' || url.length === 0) {
				return [];
			}

			return [
				{
					id: key,
					title: typeof title === 'string' && title.length > 0 ? title : key,
					url,
				},
			];
		});
	} catch {
		return [];
	}
}
