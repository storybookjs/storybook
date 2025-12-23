import type { DecoratorFunction } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filterDefs, filters } from './visionSimulatorFilters';

const knownFilters: string[] = Object.values(filters).map((f) => f.filter);

export const withVisionSimulator: DecoratorFunction = (StoryFn, { globals }) => {
  const { vision } = globals;

  const applyVisionFilter = useCallback(() => {
    const existingFilters = document.body.style.filter.split(' ').filter((filter) => {
      return filter && filter !== 'none' && !knownFilters.includes(filter);
    });

    const visionFilter = filters[vision as keyof typeof filters]?.filter;
    if (visionFilter && document.body.classList.contains('sb-show-main')) {
      document.body.style.filter = [...existingFilters, visionFilter].join(' ');
    } else {
      document.body.style.filter = existingFilters.join(' ');
    }

    return () => {
      document.body.style.filter = existingFilters.join(' ');
    };
  }, [vision]);

  useEffect(applyVisionFilter, [vision]);

  useEffect(() => {
    const observer = new MutationObserver(() => applyVisionFilter());
    observer.observe(document.body, { attributeFilter: ['class'] });

    return () => {
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
