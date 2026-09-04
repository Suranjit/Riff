import { z } from 'zod';
import type { ContextCapsule } from '@riff/shared';
import type { RiffSessionClientLike } from './RiffSessionClient.js';

/** An MCP tool response (text content). */
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type ToolHandlers = {
  push_capsule(args: unknown): ToolResponse;
  list_capsules(): ToolResponse;
  pull_capsule(args: unknown): ToolResponse;
  get_pending_riff(): ToolResponse;
};

export const pushArgsSchema = z.object({
  objective: z.string().trim().min(1),
  approach: z.string().optional(),
  keyFindings: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
});

export const pullArgsSchema = z.object({ capsuleId: z.string().min(1) });

const text = (body: string, isError = false): ToolResponse => ({
  content: [{ type: 'text', text: body }],
  ...(isError ? { isError: true } : {}),
});

function renderCapsule(c: ContextCapsule): string {
  const lines = [`• ${c.author}: ${c.objective}  [${c.id}]`];
  if (c.approach) lines.push(`  approach: ${c.approach}`);
  for (const f of c.keyFindings) lines.push(`  finding: ${f}`);
  for (const q of c.openQuestions) lines.push(`  question: ${q}`);
  if (c.riffedFrom) lines.push(`  riffed from: ${c.riffedFrom}`);
  return lines.join('\n');
}

/**
 * Build the MCP tool handlers over a session client. Claude fills the capsule
 * fields; these handlers validate and route to the client.
 */
export function createTools(client: RiffSessionClientLike): ToolHandlers {
  return {
    push_capsule(args) {
      const parsed = pushArgsSchema.safeParse(args);
      if (!parsed.success) {
        return text(`Invalid capsule: ${parsed.error.issues[0]?.message ?? 'bad input'}`, true);
      }
      const draft = client.pushCapsule(parsed.data);
      return text(`Published your capsule (${draft.id}).`);
    },

    list_capsules() {
      const capsules = client.listCapsules();
      if (capsules.length === 0) return text('No capsules on the board yet.');
      return text(capsules.map(renderCapsule).join('\n\n'));
    },

    pull_capsule(args) {
      const parsed = pullArgsSchema.safeParse(args);
      if (!parsed.success) return text('Invalid arguments: capsuleId is required.', true);
      const capsule = client.pullCapsule(parsed.data.capsuleId);
      if (!capsule) return text(`No capsule found with id ${parsed.data.capsuleId}.`, true);
      return text(
        `Riffing on ${capsule.author}'s capsule. Build on this context:\n\n${renderCapsule(capsule)}`,
      );
    },

    get_pending_riff() {
      const capsule = client.takePendingRiff();
      if (!capsule) {
        return text('No pending riffs. Click Riff on a card in the board to queue one.');
      }
      return text(
        `Riffing on ${capsule.author}'s capsule (queued from the board). Build on this context:\n\n${renderCapsule(capsule)}`,
      );
    },
  };
}
