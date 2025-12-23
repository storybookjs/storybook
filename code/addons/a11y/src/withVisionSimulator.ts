import type { DecoratorFunction } from 'storybook/internal/types';

import { useEffect } from 'storybook/preview-api';

import { filterDefs, filters } from './visionSimulatorFilters';

const knownFilters: string[] = Object.values(filters).map((f) => f.filter);

export const withVisionSimulator: DecoratorFunction = (StoryFn, { globals }) => {
  const { vision } = globals;

  useEffect(() => {
    document.body.insertAdjacentHTML('beforeend', filterDefs);

    return () => {
      document.body.removeChild(document.getElementById('storybook-a11y-vision-filters')!);
    };
  }, []);

  useEffect(() => {
    const existingFilters = document.body.style.filter.split(' ').filter((filter) => {
      return filter && filter !== 'none' && !knownFilters.includes(filter);
    });

    const visionFilter = filters[vision as keyof typeof filters]?.filter;
    if (visionFilter) {
      document.body.style.filter = [...existingFilters, visionFilter].join(' ');
    }

    return () => {
      document.body.style.filter = existingFilters.join(' ');
    };
  }, [vision]);

  return StoryFn();
};
