import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RiffMessage } from '@riff/shared';
import {
  connectClient,
  startHarness,
  TEST_JOIN_CODE,
  TestClient,
  type Harness,
} from './test/harness.js';

const SESSION = '11111111-1111-4111-8111-111111111111';
const isType =
  (type: RiffMessage['type']) =>
  (m: RiffMessage): boolean =>
    m.type === type;

type SelfStatus = Extract<RiffMessage, { type: 'self:status' }>;

/**
 * The board must be able to say whether this person's Claude Code is actually
 * listening. Without it, clicking Riff with no agent connected silently does
 * nothing while the UI claims success.
 */
describe('agent connection status', () => {
  let h: Harness;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await h.close();
  });

  async function connect(name: string, key: string, kind: 'browser' | 'agent') {
    const c = await connectClient(h, SESSION, TEST_JOIN_CODE, name, key, kind);
    clients.push(c);
    return c;
  }

  it('tells a lone browser that no agent is connected', async () => {
    const browser = await connect('Ada', 'key-ada', 'browser');
    const status = (await browser.next(isType('self:status'))) as SelfStatus;
    expect(status.agentConnected).toBe(false);
  });

  it('tells the browser when this person’s agent connects', async () => {
    const browser = await connect('Ada', 'key-ada', 'browser');
    await browser.next(isType('self:status')); // the initial false

    await connect('Ada', 'key-ada', 'agent'); // same identity, Claude Code

    const status = (await browser.next(
      (m) => m.type === 'self:status' && (m as SelfStatus).agentConnected,
    )) as SelfStatus;
    expect(status.agentConnected).toBe(true);
  });

  it('does not report someone else’s agent as yours', async () => {
    const ada = await connect('Ada', 'key-ada', 'browser');
    await ada.next(isType('self:status'));

    await connect('Grace', 'key-grace', 'agent'); // a different person's agent

    // Ada must still see no agent of her own.
    const statuses = ada.buffered(isType('self:status')) as SelfStatus[];
    expect(statuses.every((s) => s.agentConnected === false)).toBe(true);
  });

  it('reports the agent going away when it disconnects', async () => {
    const browser = await connect('Ada', 'key-ada', 'browser');
    const agent = await connect('Ada', 'key-ada', 'agent');
    await browser.next((m) => m.type === 'self:status' && (m as SelfStatus).agentConnected);

    agent.close();

    const status = (await browser.next(
      (m) => m.type === 'self:status' && !(m as SelfStatus).agentConnected,
    )) as SelfStatus;
    expect(status.agentConnected).toBe(false);
  });
});
