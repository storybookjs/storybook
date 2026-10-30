import { managerDocsInstanceFromSearch } from '../store/addressed-preview.ts';

export const shouldEmbed = ({ search }: { search: string }) => {
  return new URLSearchParams(search).get('embed') === 'true';
};

/** Embedded review thumbnails and manager-docs story instances do not autoplay. */
export const shouldAutoplay = ({ search }: { search: string }) =>
  !shouldEmbed({ search }) && managerDocsInstanceFromSearch(search) === null;
