export type ConnectPanelProps = {
  /** The ready-to-paste `npx riffboard join "…"` command. */
  command: string;
};

/** A copy-to-clipboard affordance for connecting Claude Code to this session. */
export function ConnectPanel(_props: ConnectPanelProps): JSX.Element | null {
  // TODO(#15): implement.
  return null;
}
