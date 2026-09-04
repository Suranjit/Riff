import { describe, expect, it, vi } from 'vitest';
import type { ContextCapsule } from '@riff/shared';
import { createTools } from './tools.js';
import type { PushFields, RiffSessionClientLike } from './RiffSessionClient.js';

const SESSION = '11111111-1111-4111-8111-111111111111';

function capsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: SESSION,
    author: 'Ada',
    authorId: '55555555-5555-4555-8555-555555555555',
    objective: 'Explore the graph model',
    approach: '',
    keyFindings: ['finding one'],
    openQuestions: ['question one'],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function fakeClient(overrides: Partial<RiffSessionClientLike> = {}): RiffSessionClientLike {
  return {
    pushCapsule: vi.fn((_f: PushFields) => capsule()),
    listCapsules: vi.fn(() => [capsule()]),
    pullCapsule: vi.fn((_id: string) => capsule()),
    takePendingRiff: vi.fn(() => capsule()),
    ...overrides,
  };
}

describe('push_capsule', () => {
  it('routes parsed fields to the client', () => {
    const client = fakeClient();
    const tools = createTools(client);
    const res = tools.push_capsule({
      objective: 'Explore the graph model',
      keyFindings: ['a', 'b'],
      openQuestions: ['q'],
    });
    expect(res.isError).toBeFalsy();
    expect(client.pushCapsule).toHaveBeenCalledWith(
      expect.objectContaining({ objective: 'Explore the graph model', keyFindings: ['a', 'b'] }),
    );
  });

  it('rejects an empty objective without calling the client', () => {
    const client = fakeClient();
    const tools = createTools(client);
    const res = tools.push_capsule({ objective: '   ' });
    expect(res.isError).toBe(true);
    expect(client.pushCapsule).not.toHaveBeenCalled();
  });
});

describe('list_capsules', () => {
  it('renders the board capsules as text', () => {
    const tools = createTools(fakeClient());
    const res = tools.list_capsules();
    expect(res.content[0]?.text).toContain('Explore the graph model');
    expect(res.content[0]?.text).toContain('Ada');
  });
});

describe('pull_capsule', () => {
  it('returns the pulled capsule context and calls the client', () => {
    const client = fakeClient();
    const tools = createTools(client);
    const res = tools.pull_capsule({ capsuleId: '33333333-3333-4333-8333-333333333333' });
    expect(client.pullCapsule).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
    expect(res.content[0]?.text).toContain('Explore the graph model');
  });

  it('handles an unknown capsule id gracefully', () => {
    const client = fakeClient({ pullCapsule: vi.fn(() => undefined) });
    const tools = createTools(client);
    const res = tools.pull_capsule({ capsuleId: 'nope' });
    expect(res.isError).toBe(true);
  });
});

describe('get_pending_riff', () => {
  it('returns the queued capsule context', () => {
    const client = fakeClient();
    const tools = createTools(client);
    const res = tools.get_pending_riff();
    expect(client.takePendingRiff).toHaveBeenCalled();
    expect(res.content[0]?.text).toContain('Explore the graph model');
  });

  it('reports when there is nothing queued', () => {
    const tools = createTools(fakeClient({ takePendingRiff: vi.fn(() => undefined) }));
    const res = tools.get_pending_riff();
    expect(res.content[0]?.text).toMatch(/no pending riffs/i);
  });
});

describe('push_capsule input bounds', () => {
  it('reports an over-long objective as a tool error, not a raw exception', () => {
    const client = fakeClient();
    const res = createTools(client).push_capsule({ objective: 'x'.repeat(501) });
    expect(res.isError).toBe(true);
    expect(client.pushCapsule).not.toHaveBeenCalled();
  });

  it('rejects more findings than a capsule can hold', () => {
    const client = fakeClient();
    const res = createTools(client).push_capsule({
      objective: 'Fine',
      keyFindings: Array.from({ length: 21 }, (_, i) => `f${i}`),
    });
    expect(res.isError).toBe(true);
    expect(client.pushCapsule).not.toHaveBeenCalled();
  });
});
