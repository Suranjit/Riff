import { initials, nameHue } from '../lib/format.js';

export type AvatarProps = {
  name: string;
  /** Diameter classes; defaults to a 36px avatar. */
  className?: string;
};

/** A deterministic, name-colored initials avatar. */
export function Avatar({ name, className = 'h-9 w-9 text-xs' }: AvatarProps): JSX.Element {
  const hue = nameHue(name);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-white ${className}`}
      style={{ backgroundColor: `hsl(${hue} 42% 46%)` }}
    >
      {initials(name)}
    </span>
  );
}
