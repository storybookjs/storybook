/** A listed entry, and the source to scope a follow-up call to when there are several. */
export type DocsCandidate = { id: string; name: string; storybookId?: string };

const MAX_SUGGESTIONS = 5;

// `alert-banner`, `AlertBanner` and `feedback-alertbanner` all yield `alert`, `banner` or `alertbanner`.
function tokens(value: string): Set<string> {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return new Set([...words, words.join('')]);
}

/**
 * The listed entries closest to an id that resolved to nothing, best first. A story id is matched
 * by its component part.
 */
export function suggestEntries(id: string, candidates: DocsCandidate[]): DocsCandidate[] {
  // Agents glue the source onto the id (`reshaped-button`); the source names no entry.
  const sourceIds = new Set(candidates.map((candidate) => candidate.storybookId));
  const wanted = new Set([...tokens(id.split('--')[0])].filter((token) => !sourceIds.has(token)));

  // A word most ids share, such as a `components` title prefix, says nothing about which one was meant.
  const frequency = new Map<string, number>();
  for (const candidate of candidates) {
    for (const token of tokens(candidate.id)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const commonThreshold = Math.max(2, candidates.length / 4);
  const telling = [...wanted].filter((token) => (frequency.get(token) ?? 0) <= commonThreshold);

  return candidates
    .map((candidate) => {
      const own = new Set([...tokens(candidate.id), ...tokens(candidate.name)]);
      const namesIt = wanted.has(candidate.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const score = telling.filter((token) => own.has(token)).length;
      return { candidate, score: score > 0 && namesIt ? score + 1 : score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ candidate }) => candidate);
}
