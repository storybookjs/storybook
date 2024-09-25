import { simpleGit } from 'simple-git';

export const git = simpleGit({
  config: [
    /**
     * Ensures that prereleases are listed as earlier than stable releases. WITHOUT the config, this
     * is the list of tags: v7.1.0-rc.2 v7.1.0-rc.1 v7.1.0-rc.0 v7.1.0-beta.3 ... v7.1.0 v7.0.2
     *
     * WITH the config, v7.1.0 is correctly on the top: v7.1.0 v7.1.0-rc.2 v7.1.0-rc.1 v7.1.0-rc.0
     * v7.1.0-beta.3 ... v7.0.2
     *
     * The top most tag is considered the "latest", which is used as a starting point for looking
     * for changes for upcoming releases See https://stackoverflow.com/a/52680984
     */
    'versionsort.suffix=-',
  ],
});

export async function getLatestTag() {
  return (await git.tags(['v*', '--sort=-v:refname', '--merged'])).latest;
}
