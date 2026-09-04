import { describe, expect, it } from 'vitest';
import type { ContextCapsule } from '@riff/shared';
import { renderRiffInjection } from './hook.js';

function capsule(overrides: Partial<ContextCapsule> = {}): ContextCapsule {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    sessionId: '11111111-1111-4111-8111-111111111111',
    author: 'Grace',
    authorId: '55555555-5555-4555-8555-555555555555',
    objective: 'How do participants join securely on a LAN?',
    approach: 'Join code over HTTPS',
    keyFindings: ['self-signed cert needs a fingerprint check'],
    openQuestions: ['ticket TTL?'],
    pushMode: 'manual',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('renderRiffInjection', () => {
  const text = renderRiffInjection(capsule());

  it('names the author and objective', () => {
    expect(text).toContain('Grace');
    expect(text).toContain('How do participants join securely on a LAN?');
  });

  it('includes the key findings', () => {
    expect(text).toContain('self-signed cert needs a fingerprint check');
  });
});
