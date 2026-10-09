/**
 * An entry from a listing. `storybookId` is set in a composition, where a follow-up call has to name
 * the source.
 */
export type DocsListedEntry = { id: string; name: string; storybookId?: string };

const MAX_SUGGESTIONS = 5;
const SAME_ID_SCORE = Number.MAX_SAFE_INTEGER;
const SAME_COMPONENT_SCORE = SAME_ID_SCORE - 1;
// A whole name spelled out by the id outweighs any single shared word.
const NAME_SCORE = 2;

// The words of an id or a name, plus those words joined, so that `alert-banner`, `AlertBanner` and
// `feedback-alertbanner` all share `alertbanner`.
function tokenize(value: string): Set<string> {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return new Set([...words, words.join('')]);
}

export function suggestEntries(id: string, candidates: DocsListedEntry[]): DocsListedEntry[] {
  // A story id (`button--primary`) also matches its component.
  const componentId = id.split('--')[0];

  // Agents glue the source onto the id (`reshaped-button`), so a word that is a source id is not
  // matched.
  const sourceIds = new Set(candidates.map((candidate) => candidate.storybookId));
  const wanted = new Set([...tokenize(componentId)].filter((token) => !sourceIds.has(token)));

  // A word in more than a quarter of the ids, such as a `components` title prefix, does not tell
  // entries apart. A word in one or two ids always counts, so a small Storybook still gets matches.
  const idCountByToken = new Map<string, number>();
  for (const candidate of candidates) {
    for (const token of tokenize(candidate.id)) {
      idCountByToken.set(token, (idCountByToken.get(token) ?? 0) + 1);
    }
  }
  const maxIdCount = Math.max(2, candidates.length / 4);
  const distinctive = [...wanted].filter((token) => (idCountByToken.get(token) ?? 0) <= maxIdCount);

  const scoreOf = (candidate: DocsListedEntry) => {
    if (candidate.id === id) {
      return SAME_ID_SCORE;
    }
    if (candidate.id === componentId) {
      return SAME_COMPONENT_SCORE;
    }
    const candidateTokens = new Set([...tokenize(candidate.id), ...tokenize(candidate.name)]);
    const sharedWords = distinctive.filter((token) => candidateTokens.has(token)).length;
    const joinedName = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return sharedWords + (wanted.has(joinedName) ? NAME_SCORE : 0);
  };

  return candidates
    .map((candidate) => ({ candidate, score: scoreOf(candidate) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ candidate }) => candidate);
}
