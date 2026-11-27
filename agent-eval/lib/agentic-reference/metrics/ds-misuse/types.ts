// What the judge returns, and the schema that guarantees it.
//
// The schema is handed to the Messages API as output_config.format, so the model
// cannot return a shape this file does not describe. That is why there is no
// defensive parsing anywhere downstream.
import { MISUSE_FACET_IDS, type FacetId } from '../../facets.ts';
import type { NodeRecord } from '../ds-coverage/types.ts';

/** 1 right, 0.5 ambiguous or debatable, 0 wrong. */
export type JudgeScore = 0 | 0.5 | 1;

/** One ground for a score: a cited documentation facet, or an uncategorised judgement call. */
export interface JudgeReason {
  /** Qualified facet id from the misuse catalogue; absent = uncategorised. */
  facet?: FacetId;
  /** Why. A bare number is not reviewable, and this is the first thing anyone asks. */
  text: string;
}

export interface ScoredAnswer {
  score: JudgeScore;
  /** Every distinct ground, not just the most salient one. At least one. */
  reasons: JudgeReason[];
}

export interface JudgedNode {
  path: string;
  file: string;
  line: number;
  tag: string;
  kind: 'ds' | 'local';
  /** DS nodes only. */
  correctDsDecision?: ScoredAnswer;
  /** DS nodes only. */
  correctDsUsage?: ScoredAnswer;
  /** Local nodes only. */
  correctLocalDecision?: ScoredAnswer;
}

/** Exactly what the model is constrained to return. */
export interface JudgeResponse {
  nodes: JudgedNode[];
}

export interface DsMisuseSummary {
  /** Mean over DS nodes, or null when none were evaluated. */
  correctDsDecision: number | null;
  correctDsUsage: number | null;
  /** Mean over local nodes, or null when none were evaluated. */
  correctLocalDecision: number | null;
  evaluated: { ds: number; local: number };
}

export interface DsMisuseReport {
  /**
   * DS_MISUSE_JUDGE_VERSION at judging time (see ./context.ts). Drives
   * staleness alongside dsGuidelinesRef and model. v1 artifacts carried a
   * separate schemaVersion and a single reason string per answer; they fail
   * the shape guard and read as unjudged.
   */
  judgeVersion: number;
  /** The metricsVersion the node census was built under. Provenance only: it plays no part in staleness. */
  metricsVersion: number | undefined;
  judgedAt: string;
  model: string;
  /** `repo@sha` of the guidelines. A moved pin invalidates this artifact. */
  dsGuidelinesRef: string;
  /** `repo@ref` of the tree the run worked on. */
  fixtureRef: string;
  diffTruncated: boolean;
  summary: DsMisuseSummary;
  nodes: JudgedNode[];
}

/** What the judge is given about one side of the comparison. */
export interface NodeCensus {
  nodes: NodeRecord[];
}

const REASON = {
  type: 'object',
  properties: {
    facet: { type: 'string', enum: MISUSE_FACET_IDS as readonly string[] },
    text: { type: 'string' },
  },
  required: ['text'],
  additionalProperties: false,
} as const;

const SCORED_ANSWER = {
  type: 'object',
  properties: {
    score: { type: 'number', enum: [0, 0.5, 1] },
    reasons: { type: 'array', items: REASON },
  },
  required: ['score', 'reasons'],
  additionalProperties: false,
} as const;

/**
 * The JSON schema handed to output_config.format.
 *
 * Written out rather than generated: `additionalProperties: false` is required
 * on every object, recursion is unsupported, and the two per-kind score groups
 * are deliberately optional rather than nullable — a local node has no
 * correct-ds-decision to give, and a null there would read as a zero.
 */
export const JUDGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          tag: { type: 'string' },
          kind: { type: 'string', enum: ['ds', 'local'] },
          correctDsDecision: SCORED_ANSWER,
          correctDsUsage: SCORED_ANSWER,
          correctLocalDecision: SCORED_ANSWER,
        },
        required: ['path', 'file', 'line', 'tag', 'kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['nodes'],
  additionalProperties: false,
} as const;
