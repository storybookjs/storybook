import { spyOn } from 'storybook/test';

export const mockReducedMotion = () => {
  const matchMedia = window.matchMedia.bind(window);
  const spy = spyOn(window, 'matchMedia').mockImplementation((query) => {
    const list = matchMedia(query);
    return query === '(prefers-reduced-motion: reduce)'
      ? Object.defineProperty(list, 'matches', { value: true })
      : list;
  });
  return () => spy.mockRestore();
};
