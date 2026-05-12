/**
 * Score an agent's clustering output against the deterministic baseline
 * (treated as ground truth for this eval).
 *
 * - recall = fraction of GT stories the agent included in any cluster
 * - precision = fraction of agent stories that were in GT (not hallucinated)
 * - clusterPurity = within each cluster, fraction sharing the dominant
 *   story-id namespace prefix
 */
import type { ChangeContextPayload } from './build-payload.ts';

export interface Cluster {
  id: string;
  rationale: string;
  representative: string;
  stories: string[];
}

export interface Scores {
  recall: number;
  precision: number;
  clusterPurity: number;
  groundTruthSize: number;
  agentOutputSize: number;
  duplicateCount: number;
  hallucinationCount: number;
  missingCount: number;
}

export function score(payload: ChangeContextPayload, clusters: Cluster[]): Scores {
  const groundTruth = new Set([
    ...payload.modified,
    ...payload.affected,
    ...payload.new,
    ...payload.cssAffected,
  ]);
  const groundTruthSize = groundTruth.size;

  const agentSet = new Set<string>();
  let duplicateCount = 0;
  for (const c of clusters) {
    for (const id of c.stories) {
      if (agentSet.has(id)) duplicateCount++;
      agentSet.add(id);
    }
  }

  const overlap = new Set([...agentSet].filter((id) => groundTruth.has(id)));
  const hallucinations = [...agentSet].filter((id) => !groundTruth.has(id));
  const missing = [...groundTruth].filter((id) => !agentSet.has(id));

  const recall = groundTruthSize > 0 ? overlap.size / groundTruthSize : 1;
  const precision = agentSet.size > 0 ? overlap.size / agentSet.size : 1;

  let purityNum = 0;
  let purityDen = 0;
  for (const c of clusters) {
    if (c.stories.length < 2) continue;
    const nsCounts = new Map<string, number>();
    for (const id of c.stories) {
      const ns = id.split('--')[0];
      nsCounts.set(ns, (nsCounts.get(ns) || 0) + 1);
    }
    const dominant = Math.max(...nsCounts.values());
    purityNum += dominant;
    purityDen += c.stories.length;
  }
  const clusterPurity = purityDen > 0 ? purityNum / purityDen : 1;

  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    recall: round(recall),
    precision: round(precision),
    clusterPurity: round(clusterPurity),
    groundTruthSize,
    agentOutputSize: agentSet.size,
    duplicateCount,
    hallucinationCount: hallucinations.length,
    missingCount: missing.length,
  };
}
