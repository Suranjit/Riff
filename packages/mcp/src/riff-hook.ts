#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: if a Riff was queued from the board, print
// the capsule context to stdout so it is injected before the user's next message.
import { runHook } from './hook.js';

const injection = runHook();
if (injection) {
  process.stdout.write(injection);
}
