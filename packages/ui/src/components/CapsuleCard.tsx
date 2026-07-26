import type { ContextCapsule } from '@riff/shared';

export type CapsuleCardProps = {
  capsule: ContextCapsule;
  /** e.g. "riffed from Ada"; omitted when there is no lineage. */
  lineageLabel?: string;
  /** True when this is the viewer's own capsule (Riff disabled). */
  isOwn: boolean;
  /** The seam where the eventual Claude Code handoff attaches. */
  onRiff: (capsule: ContextCapsule) => void;
};

export function CapsuleCard(_props: CapsuleCardProps): JSX.Element | null {
  // TODO(#3): implement.
  return null;
}
