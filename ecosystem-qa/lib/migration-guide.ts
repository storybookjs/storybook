import { mkdirSync, writeFileSync } from 'node:fs';

import { dirname } from 'pathe';

export const CHECKOUT_GUIDE = 'checkout';

const guideUrl = (ref: string) =>
  `https://raw.githubusercontent.com/storybookjs/storybook/${ref}/MIGRATION.md`;

interface GuidePlaces {
  checkout: string;
  saveTo: string;
  load?: (url: string) => Promise<Response>;
}

// The guide at the tag or commit of the tested version says what that version documents. The copy
// of the checkout can be older or newer, so it only stands in for a ref that does not exist.
export const guideFor = async (
  ref: string,
  { checkout, saveTo, load = fetch }: GuidePlaces
): Promise<{ file: string; ref: string }> => {
  const response = await load(guideUrl(ref));
  if (response.status === 404) {
    return { file: checkout, ref: CHECKOUT_GUIDE };
  }
  if (!response.ok) {
    throw new Error(`Could not load the migration guide of ${ref}: HTTP ${response.status}.`);
  }
  mkdirSync(dirname(saveTo), { recursive: true });
  writeFileSync(saveTo, await response.text());
  return { file: saveTo, ref };
};
