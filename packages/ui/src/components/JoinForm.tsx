export type JoinFormProps = {
  onSubmit: (values: { name: string; code: string }) => void;
  /** Error message to display (e.g. after a failed auth). */
  error?: string;
  /** Disables the form while a join is in flight. */
  busy?: boolean;
};

export function JoinForm(_props: JoinFormProps): JSX.Element | null {
  // TODO(#3): implement.
  return null;
}
