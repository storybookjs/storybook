/**
 * Expand cluster *signatures* (emitted by the signature-based categoriser
 * prompt) into the per-story cluster shape that `score()` expects.
 *
 * Each story is assigned to the FIRST cluster whose signature matches it.
 * Unmatched stories aren't placed anywhere — but the prompt requires the
 * last cluster to be a catch-all `regex: ".*"`, so unmatched should be 0
 * for any well-formed agent output.
 */
import type { Cluster } from './score.ts';

export interface SignatureCluster {
  id: string;
  rationale: string;
  representative: string;
  signature: { type: 'prefix' | 'regex' | 'ids'; value: string | string[] };
}

export interface ExpansionResult {
  clusters: Cluster[];
  unmatched: string[];
}

export function expandSignatures(
  signatureClusters: SignatureCluster[],
  allStoryIds: string[]
): ExpansionResult {
  const compiled = signatureClusters.map((c) => {
    const sig = c.signature;
    let test: (id: string) => boolean;
    if (sig.type === 'prefix' && typeof sig.value === 'string') {
      const prefix = sig.value;
      test = (id) => id.startsWith(prefix);
    } else if (sig.type === 'regex' && typeof sig.value === 'string') {
      let re: RegExp;
      try {
        re = new RegExp(sig.value);
      } catch {
        re = /(?!)/; // never matches
      }
      test = (id) => re.test(id);
    } else if (sig.type === 'ids' && Array.isArray(sig.value)) {
      const set = new Set(sig.value);
      test = (id) => set.has(id);
    } else {
      test = () => false;
    }
    return {
      id: c.id,
      rationale: c.rationale,
      representative: c.representative,
      stories: [] as string[],
      test,
    };
  });

  const unmatched: string[] = [];
  for (const id of allStoryIds) {
    let placed = false;
    for (const c of compiled) {
      if (c.test(id)) {
        c.stories.push(id);
        placed = true;
        break;
      }
    }
    if (!placed) unmatched.push(id);
  }

  return {
    clusters: compiled.map(({ test: _t, ...rest }) => rest),
    unmatched,
  };
}
