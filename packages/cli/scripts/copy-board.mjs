// Copy the built board (@riff/ui/dist) into ./board so the published package
// serves it with no workspace present.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, '..', 'board');
const require = createRequire(import.meta.url);

const uiPkg = require.resolve('@riff/ui/package.json');
const uiDist = join(dirname(uiPkg), 'dist');

if (!existsSync(join(uiDist, 'index.html'))) {
  console.error('Board not built. Run `pnpm --filter @riff/ui build` first.');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(uiDist, dest, { recursive: true });
console.log(`Copied board -> ${dest}`);
