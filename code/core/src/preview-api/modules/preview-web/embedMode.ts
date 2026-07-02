export const shouldEmbed = ({ search }: { search: string }) => {
  return new URLSearchParams(search).get('embed') === 'true';
};

/** Embedded review thumbnails are too narrow for manager interaction plays. */
export const shouldAutoplay = ({ search }: { search: string }) => !shouldEmbed({ search });
