import { mkdirSync, writeFileSync } from 'node:fs';

import { dirname } from 'pathe';

export const CHECKOUT_GUIDE = 'checkout';

const guideUrl = (tag: string) =>
  `https://raw.githubusercontent.com/storybookjs/storybook/${tag}/MIGRATION.md`;

interface GuidePlaces {
  checkout: string;
  saveTo: string;
  load?: (url: string) => Promise<Response>;
}

// The guide that shipped with the tested version says what that version documents. The copy of the
// checkout can be older or newer, so it only stands in for a version without a tag, such as a canary.
export const guideFor = async (
  version: string,
  { checkout, saveTo, load = fetch }: GuidePlaces
): Promise<{ file: string; ref: string }> => {
  const tag = `v${version}`;
  const response = await load(guideUrl(tag));
  if (response.status === 404) {
    return { file: checkout, ref: CHECKOUT_GUIDE };
  }
  if (!response.ok) {
    throw new Error(`Could not load the migration guide of ${tag}: HTTP ${response.status}.`);
  }
  mkdirSync(dirname(saveTo), { recursive: true });
  writeFileSync(saveTo, await response.text());
  return { file: saveTo, ref: tag };
};
