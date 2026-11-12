// A fine-grained token belongs to one owner, so each org the filer may push to has its own secret.
const PUSH_TOKEN_ENV = {
  storybookjs: 'ECOSYSTEM_QA_PUSH_TOKEN',
  'storybook-tmp': 'ECOSYSTEM_QA_PUSH_TOKEN_STORYBOOK_TMP',
} as const;

const ownerOf = (repo: string): string => repo.split('/')[0] ?? '';

const hasPushToken = (owner: string): owner is keyof typeof PUSH_TOKEN_ENV =>
  Object.hasOwn(PUSH_TOKEN_ENV, owner);

/** Whether a push token is configured for the owner of an `owner/name` repo. */
export const canPushTo = (repo: string): boolean => hasPushToken(ownerOf(repo));

/**
 * Return the name of the env var that holds the push token for the owner of an `owner/name` repo.
 *
 * @throws When the owner has no push token configured.
 */
export const pushTokenEnv = (repo: string): string => {
  const owner = ownerOf(repo);
  if (!hasPushToken(owner)) {
    throw new Error(`No push token is configured for the owner of "${repo}".`);
  }
  return PUSH_TOKEN_ENV[owner];
};
