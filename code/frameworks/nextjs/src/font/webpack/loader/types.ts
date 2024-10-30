export type LoaderOptions = {
  /** Initial import name. Can be `next/font/google` or `next/font/local` */
  source: string;
  /** Props passed to the `next/font` function call */
  props: Record<string, any>;
  /** Font Family name */
  fontFamily: string;
  /** Filename of the issuer file, which imports `next/font/google` or `next/font/local */
  filename: string;
};
