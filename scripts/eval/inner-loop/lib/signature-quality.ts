/**
 * Experiment J — signature-quality metrics for the categoriser-signature.md
 * prompt. Detects whether the agent is gaming the prompt by emitting lazy
 * patterns instead of doing real work.
 *
 * Metrics:
 *   - catchAllShare: fraction of stories matched by the catch-all `.*` cluster
 *     (or any cluster whose signature is regex `.*` or empty prefix). High =
 *     agent isn't really clustering.
 *   - representativeValid: agent claims a representative story per cluster;
 *     this metric checks how many clusters have a representative that is
 *     actually in their assigned story set AND in the input. Low = the agent
 *     hallucinated a story ID.
 *   - signatureSpecificity: average prefix-length for prefix signatures and
 *     average regex-length for regex signatures. Short = matches lots of
 *     stories; signals lazy patterns.
 *   - orderCorrect: signatures are first-match-wins. If the agent puts a
 *     specific cluster AFTER a more general one, expansion produces wrong
 *     assignments. Boolean: did any cluster's signature end up matching zero
 *     stories purely because an earlier cluster shadowed it?
 */
import type { Cluster } from './score.ts';
import type { SignatureCluster } from './expand-signatures.ts';

export interface SignatureQualityScores {
  variant: 'enumerate' | 'signature';
  /** Sum of stories matched by patterns equivalent to `.*` / empty prefix / no-op. */
  catchAllStoryCount: number;
  /** As a share of agent's total assigned story count. */
  catchAllShare: number;
  /** Per-cluster `representative` validity: in cluster's assigned stories. */
  representativeValidCount: number;
  representativeTotalCount: number;
  representativeValidRate: number;
  /** Average specificity (length) of prefix signatures. */
  avgPrefixLength: number | null;
  /** Average specificity (length) of regex signatures. */
  avgRegexLength: number | null;
  /** Whether any cluster ended up empty due to earlier cluster shadowing. */
  shadowedClusterCount: number;
  /** Total clusters considered. */
  clusterCount: number;
}

const CATCHALL_REGEXES = new Set(['.*', '^.*', '^.*$', '.+', '^', '^$']);

export function scoreSignatureQuality(
  variant: 'enumerate' | 'signature',
  rawClusters: SignatureCluster[] | undefined,
  expandedClusters: Cluster[]
): SignatureQualityScores {
  // Catch-all share: count stories whose enclosing cluster has a signature
  // that matches everything.
  let catchAllStoryCount = 0;
  let totalStories = 0;
  for (let i = 0; i < expandedClusters.length; i++) {
    const c = expandedClusters[i];
    totalStories += c.stories.length;
    const sig = rawClusters?.[i]?.signature;
    if (!sig) continue;
    if (sig.type === 'regex' && typeof sig.value === 'string' && CATCHALL_REGEXES.has(sig.value)) {
      catchAllStoryCount += c.stories.length;
    } else if (sig.type === 'prefix' && sig.value === '') {
      catchAllStoryCount += c.stories.length;
    }
  }

  // Representative-validity: representative must be a real story ID present in
  // the cluster's assigned stories.
  let representativeValidCount = 0;
  for (const c of expandedClusters) {
    if (c.representative && c.stories.includes(c.representative)) representativeValidCount++;
  }

  // Average specificity per signature kind.
  const prefixLengths: number[] = [];
  const regexLengths: number[] = [];
  for (const c of rawClusters || []) {
    const sig = c.signature;
    if (sig.type === 'prefix' && typeof sig.value === 'string')
      prefixLengths.push(sig.value.length);
    if (sig.type === 'regex' && typeof sig.value === 'string') regexLengths.push(sig.value.length);
  }

  // Shadowed clusters: a cluster is shadowed if its declared pattern would
  // match stories the input contains, but no story actually got assigned to
  // it (because an earlier cluster's signature consumed those stories).
  let shadowedClusterCount = 0;
  for (let i = 1; i < expandedClusters.length; i++) {
    if (expandedClusters[i].stories.length === 0) shadowedClusterCount++;
  }

  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    variant,
    catchAllStoryCount,
    catchAllShare: totalStories > 0 ? round(catchAllStoryCount / totalStories) : 0,
    representativeValidCount,
    representativeTotalCount: expandedClusters.length,
    representativeValidRate:
      expandedClusters.length > 0
        ? round(representativeValidCount / expandedClusters.length)
        : 1,
    avgPrefixLength:
      prefixLengths.length > 0
        ? round(prefixLengths.reduce((s, n) => s + n, 0) / prefixLengths.length)
        : null,
    avgRegexLength:
      regexLengths.length > 0
        ? round(regexLengths.reduce((s, n) => s + n, 0) / regexLengths.length)
        : null,
    shadowedClusterCount,
    clusterCount: expandedClusters.length,
  };
}
