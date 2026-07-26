import { z } from 'zod';

/**
 * A Context Capsule is the unit of sharing in Riff: a compact, structured
 * snapshot of one participant's line of thinking, published from their Claude
 * Code session to the shared board.
 */
export type ContextCapsule = {
  /** uuid v4, unique per capsule. */
  id: string;
  /** The room / session this capsule belongs to. */
  sessionId: string;
  /** Participant display name (1–60 chars). */
  author: string;
  /** What this participant is trying to solve (1–500 chars). */
  objective: string;
  /** The angle being taken (0–500 chars). */
  approach: string;
  /** What Claude has surfaced so far (≤ 20 items, ≤ 500 chars each). */
  keyFindings: string[];
  /** What is still unclear (≤ 20 items, ≤ 500 chars each). */
  openQuestions: string[];
  /** The capsule this one was forked from, if any (lineage). */
  riffedFrom?: string;
  /** How this capsule was published. */
  pushMode: 'auto' | 'manual';
  /** Creation time (unix ms). */
  createdAt: number;
  /** Last update time (unix ms); always >= createdAt. */
  updatedAt: number;
};

/** A connected participant in a Riff session. */
export type Participant = {
  id: string;
  name: string;
  role: 'host' | 'guest';
  joinedAt: number;
};

/** Input to {@link createCapsule}. Timestamps/ids are injected for testability. */
export type CreateCapsuleInput = {
  id: string;
  sessionId: string;
  author: string;
  objective: string;
  approach?: string;
  keyFindings?: string[];
  openQuestions?: string[];
  riffedFrom?: string;
  pushMode: 'auto' | 'manual';
  /** Current time in unix ms, injected by the caller. */
  now: number;
};

// TODO(#1): implement — placeholder schema so tests compile and run red.
export const participantSchema = z.never();

// TODO(#1): implement — placeholder schema so tests compile and run red.
export const contextCapsuleSchema = z.never();

/**
 * Build a validated {@link ContextCapsule}, filling defaults (timestamps from
 * the injected `now`, empty finding/question arrays). Pure: no clocks or RNG.
 */
export function createCapsule(_input: CreateCapsuleInput): ContextCapsule {
  // TODO(#1): implement.
  throw new Error('createCapsule is not implemented yet (#1)');
}
