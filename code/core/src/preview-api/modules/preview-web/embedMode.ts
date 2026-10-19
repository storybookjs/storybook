export const shouldEmbed = ({ search }: { search: string }) => {
  return new URLSearchParams(search).get('embed') === 'true';
};

/**
 * Embedded review thumbnails are too narrow for manager interaction plays. A page that shows the
 * story in an iframe, such as a docs page, turns its play off with `autoplay=false`.
 */
export const shouldAutoplay = ({ search }: { search: string }) =>
  !shouldEmbed({ search }) && new URLSearchParams(search).get('autoplay') !== 'false';
