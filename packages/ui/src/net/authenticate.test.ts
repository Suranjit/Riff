import { describe, expect, it, vi } from 'vitest';
import { authenticate, AuthError } from './authenticate.js';
import { SESSION } from '../test/fixtures.js';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

describe('authenticate', () => {
  it('posts to the auth endpoint with credential and name', async () => {
    const fetchMock = fakeFetch(200, {
      ticket: 't',
      participantId: 'p',
      role: 'guest',
    });
    await authenticate({
      baseUrl: 'https://host:4747',
      sessionId: SESSION,
      credential: 'RIFF-CODE',
      name: 'Ada',
      fetch: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://host:4747/rooms/${SESSION}/auth`,
      expect.objectContaining({ method: 'POST' }),
    );
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      credential: 'RIFF-CODE',
      name: 'Ada',
      client: 'browser',
    });
  });

  it('includes the participantKey in the body when provided', async () => {
    const fetchMock = fakeFetch(200, { ticket: 't', participantId: 'p', role: 'guest' });
    await authenticate({
      baseUrl: 'https://host:4747',
      sessionId: SESSION,
      credential: 'RIFF-CODE',
      name: 'Ada',
      participantKey: 'key-ada',
      fetch: fetchMock,
    });
    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      credential: 'RIFF-CODE',
      name: 'Ada',
      client: 'browser',
      participantKey: 'key-ada',
    });
  });

  it('returns the ticket, participantId and role on success', async () => {
    const result = await authenticate({
      baseUrl: 'https://host:4747',
      sessionId: SESSION,
      credential: 'RIFF-CODE',
      name: 'Ada',
      fetch: fakeFetch(200, { ticket: 'tok', participantId: 'pid', role: 'guest' }),
    });
    expect(result).toEqual({ ticket: 'tok', participantId: 'pid', role: 'guest' });
  });

  it('throws AuthError on a 401', async () => {
    await expect(
      authenticate({
        baseUrl: 'https://host:4747',
        sessionId: SESSION,
        credential: 'WRONG',
        name: 'Ada',
        fetch: fakeFetch(401, { error: 'invalid_credential' }),
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
