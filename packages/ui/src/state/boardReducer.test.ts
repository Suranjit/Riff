import { describe, expect, it } from 'vitest';
import { boardReducer, initialBoardState, riffedFromLabel } from './boardReducer.js';
import { capsule, participant } from '../test/fixtures.js';

describe('boardReducer', () => {
  it('replaces state on session:snapshot', () => {
    const p = participant();
    const c = capsule();
    const next = boardReducer(initialBoardState, {
      type: 'session:snapshot',
      participants: [p],
      capsules: [c],
    });
    expect(next.participants).toEqual([p]);
    expect(next.capsules).toEqual([c]);
  });

  it('inserts a new capsule on capsule:updated', () => {
    const next = boardReducer(initialBoardState, {
      type: 'capsule:updated',
      capsule: capsule(),
    });
    expect(next.capsules).toHaveLength(1);
  });

  it('replaces an existing capsule by id rather than duplicating', () => {
    const s1 = boardReducer(initialBoardState, {
      type: 'capsule:updated',
      capsule: capsule({ objective: 'first', updatedAt: 1_000 }),
    });
    const s2 = boardReducer(s1, {
      type: 'capsule:updated',
      capsule: capsule({ objective: 'second', updatedAt: 2_000 }),
    });
    expect(s2.capsules).toHaveLength(1);
    expect(s2.capsules[0]?.objective).toBe('second');
  });

  it('keeps capsules sorted by updatedAt descending', () => {
    const older = capsule({ id: '33333333-3333-4333-8333-333333333333', updatedAt: 1_000 });
    const newer = capsule({ id: '44444444-4444-4444-8444-444444444444', updatedAt: 5_000 });
    let state = boardReducer(initialBoardState, { type: 'capsule:updated', capsule: older });
    state = boardReducer(state, { type: 'capsule:updated', capsule: newer });
    expect(state.capsules.map((c) => c.id)).toEqual([newer.id, older.id]);
  });

  it('adds a participant on participant:joined', () => {
    const next = boardReducer(initialBoardState, {
      type: 'participant:joined',
      participant: participant(),
    });
    expect(next.participants).toHaveLength(1);
  });

  it('removes a participant on participant:left', () => {
    const p = participant();
    const joined = boardReducer(initialBoardState, { type: 'participant:joined', participant: p });
    const left = boardReducer(joined, { type: 'participant:left', participantId: p.id });
    expect(left.participants).toEqual([]);
  });

  it('does not mutate the previous state', () => {
    const before = initialBoardState;
    boardReducer(before, { type: 'capsule:updated', capsule: capsule() });
    expect(before.capsules).toEqual([]);
  });
});

describe('riffedFromLabel', () => {
  it('resolves riffedFrom to the source author name', () => {
    const source = capsule({ id: '33333333-3333-4333-8333-333333333333', author: 'Ada' });
    const child = capsule({
      id: '44444444-4444-4444-8444-444444444444',
      author: 'Grace',
      riffedFrom: source.id,
    });
    const state = { participants: [], capsules: [source, child] };
    expect(riffedFromLabel(state, child)).toBe('riffed from Ada');
  });

  it('returns undefined when there is no lineage', () => {
    expect(riffedFromLabel({ participants: [], capsules: [] }, capsule())).toBeUndefined();
  });

  it('returns undefined when the source capsule is unknown', () => {
    const child = capsule({ riffedFrom: '99999999-9999-4999-8999-999999999999' });
    expect(riffedFromLabel({ participants: [], capsules: [child] }, child)).toBeUndefined();
  });
});
