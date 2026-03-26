import type { DecoratorFunction } from 'storybook/internal/types';

import { useCallback, useEffect } from 'storybook/preview-api';

import { filterDefs, filters } from './visionSimulatorFilters';

const knownFilters = Object.values(filters).map((f) => f.filter);
const knownFiltersRegExp = new RegExp(`\\b(${knownFilters.join('|')})\\b`, 'g');

export const withVisionSimulator: DecoratorFunction = (StoryFn, { globals }) => {
  const { vision } = globals;

  const applyVisionFilter = useCallback(() => {
    const existingFilters = document.body.style.filter.replaceAll(knownFiltersRegExp, '').trim();

    const visionFilter = filters[vision as keyof typeof filters]?.filter;
    if (visionFilter && document.body.classList.contains('sb-show-main')) {
      if (!existingFilters || existingFilters === 'none') {
        document.body.style.filter = visionFilter;
      } else {
        document.body.style.filter = `${existingFilters} ${visionFilter}`;
      }
    } else {
      document.body.style.filter = existingFilters || 'none';
    }

    return () => (document.body.style.filter = existingFilters || 'none');
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
