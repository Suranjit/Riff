#!/usr/bin/env node
import { runMcpServer } from './runServer.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

async function main(): Promise<void> {
  await runMcpServer({
    baseUrl: required('RIFF_URL'),
    sessionId: required('RIFF_SESSION'),
    joinCode: required('RIFF_JOIN_CODE'),
    name: required('RIFF_NAME'),
    participantKey: process.env.RIFF_PARTICIPANT_KEY,
    fingerprint: process.env.RIFF_FINGERPRINT,
    insecure: process.env.RIFF_INSECURE === '1',
  });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
