import type { DecoratorFunction } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filterDefs, filters } from './visionSimulatorFilters.ts';

const knownFilters = Object.values(filters).map((f) => f.filter);

const stripKnownFilters = (filterValue: string) => {
  let result = filterValue.trim();
  if (!result || result === 'none') {
    return '';
  }
  for (const knownFilter of knownFilters) {
    while (result.includes(knownFilter)) {
      result = result.replace(knownFilter, ' ');
    }
  }
  return result.replace(/\s+/g, ' ').trim();
};

export const withVisionSimulator: DecoratorFunction = (StoryFn, { globals }) => {
  const { vision } = globals;

  const applyVisionFilter = useCallback(() => {
    const baseFilters = stripKnownFilters(document.body.style.filter);
    const visionFilter = filters[vision as keyof typeof filters]?.filter;
    const nextFilter =
      visionFilter && document.body.classList.contains('sb-show-main')
        ? baseFilters
          ? `${baseFilters} ${visionFilter}`
          : visionFilter
        : baseFilters || 'none';

    document.body.style.filter = nextFilter;

    return () => {
      document.body.style.filter = baseFilters || 'none';
    };
  }, [vision]);

  useEffect(() => {
    const cleanup = applyVisionFilter();

    const observer = new MutationObserver(() => applyVisionFilter());
    observer.observe(document.body, { attributeFilter: ['class'] });

    return () => {
      cleanup();
      observer.disconnect();
    };
  }, [applyVisionFilter]);

  useEffect(() => {
    document.body.insertAdjacentHTML('beforeend', filterDefs);

    return () => {
      const filterDefsElement = document.getElementById('storybook-a11y-vision-filters');
      filterDefsElement?.parentElement?.removeChild(filterDefsElement);
    };
  }, []);

  return StoryFn();
};
