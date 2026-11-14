// a separate module so tests can mock it and create stores with arbitrary ids
const FIRST_PARTY_STORE_IDS = new Set([
  'storybook/status',
  'storybook/test-provider',
  'storybook/checklist',
  'storybook/test',
]);

export const isFirstPartyStoreId = (id: string) => FIRST_PARTY_STORE_IDS.has(id);
