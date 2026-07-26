import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // Bundle the workspace packages (they are not published on their own); keep
  // real npm dependencies external so they install normally.
  noExternal: [/^@riff\//],
  // The shebang is preserved from src/cli.ts; adding one here would duplicate it.
});
