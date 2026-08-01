export const shouldEmbed = ({ search }: { search: string }): boolean => {
  return new URLSearchParams(search).get('embed') === 'true';
};

/** Embedded review thumbnails are too narrow for manager interaction plays. */
export const shouldAutoplay = ({ search }: { search: string }): boolean => !shouldEmbed({ search });
